"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  AlertTriangle, RotateCcw, Truck, Trash2, CheckCircle2, 
  Search, Filter, Clock, ArrowRight, ShieldAlert, 
  FileText, User, Calendar, Plus, RefreshCw, ChevronRight,
  TrendingDown, DollarSign, Wrench, CheckCheck, XCircle, AlertCircle,
  ClipboardCheck, Activity, Settings, CheckSquare, Layers, Lock, Edit3, Download, Printer,
  Package, Boxes, Wrench as ToolIcon, Eye, X, SlidersHorizontal, ChevronDown, ChevronUp,
  LayoutGrid
} from 'lucide-react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  generateMRBCorrectiveActionPDF,
  generateReturnInvoicePDF,
  generateReplacementDcPDF,
  generateScrapCertificatePDF
} from '@/src/utils/frontendPdfHelper';
import { generateSCNPDF } from '@/src/utils/generateSCNPDF';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface RejectionReworkHubProps {
  context?: 'quality' | 'store' | 'wip-jobwork';
}

type QCTypeFilter = 'all' | 'IncomingQC' | 'ProcessQC' | 'JobWorkQC' | 'FGQC';
type StoreCategoryFilter = 'all' | 'rm' | 'bo' | 'consumable' | 'fg' | 'pdi';
type JwTypeFilter = 'all' | 'store-to-wip' | 'wip-to-wip' | 'store-conversion';
type DateFilterMode = 'all' | 'daily' | 'monthly';

export default function RejectionReworkHub({ context = 'quality' }: RejectionReworkHubProps) {
  const [showDashboard, setShowDashboard] = useState<boolean>(true);
  const initialQcType: QCTypeFilter = context === 'store' ? 'IncomingQC' : (context === 'wip-jobwork' ? 'JobWorkQC' : 'all');
  const [activeQcType, setActiveQcType] = useState<QCTypeFilter>(initialQcType);
  const [storeCategory, setStoreCategory] = useState<StoreCategoryFilter>('all');
  const [jwCategory, setJwCategory] = useState<JwTypeFilter>('all');
  const [loading, setLoading] = useState<boolean>(true);
  
  // Filters: Search, Supplier, Date/Month, Status, Defect
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [monthFilter, setMonthFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [defectFilter, setDefectFilter] = useState<string>('all');
  const [showMobileFilters, setShowMobileFilters] = useState<boolean>(false);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (supplierFilter !== 'all') count++;
    if (statusFilter !== 'all') count++;
    if (defectFilter !== 'all') count++;
    if (dateFilterMode !== 'all') count++;
    return count;
  }, [supplierFilter, statusFilter, defectFilter, dateFilterMode]);

  const clearAllFilters = () => {
    setSearchTerm('');
    setSupplierFilter('all');
    setStatusFilter('all');
    setDefectFilter('all');
    setDateFilterMode('all');
    setDateFilter('');
    setMonthFilter('');
  };
  
  // Data States
  const [queue, setQueue] = useState<any[]>([]);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [scrapData, setScrapData] = useState<any>({ scrapTickets: [], summary: {} });

  // Disposition Action Modal State
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [actionType, setActionType] = useState<
    'Return to Vendor' | 'Vendor Replacement' | 'Internal Rework' | 'External Rework' | 'Scrap & Write-Off' | 'Accept on Deviation'
  >('Return to Vendor');
  const [actionNotes, setActionNotes] = useState<string>('');
  const [submittingAction, setSubmittingAction] = useState<boolean>(false);

  // Edit Action Modal State (24-Hour Edit Window)
  const [editTicket, setEditTicket] = useState<any | null>(null);

  // Sub-payload form fields
  const [rtvPayload, setRtvPayload] = useState<any>({ challanNumber: '', debitNoteNumber: '', vehicleNumber: '', taxRate: 18 });
  const [reworkPayload, setReworkPayload] = useState<any>({ assignedWorkstation: 'Shop Floor Bench 1', assignedToUser: '', reworkInstructions: '' });
  const [scrapPayload, setScrapPayload] = useState<any>({ scrapLocation: 'Scrap Yard Bay A', salvageRatePerKg: 0 });
  const [concessionPayload, setConcessionPayload] = useState<any>({ deviationRefNumber: '', concessionReason: '', usageConditions: 'Use As Is' });

  // Rework Complete Modal State
  const [reworkModalTicket, setReworkModalTicket] = useState<any | null>(null);
  const [reworkCompleteForm, setReworkCompleteForm] = useState<any>({
    reworkQcStatus: 'Passed',
    passedQuantity: 0,
    scrappedQuantity: 0,
    hoursSpent: 1,
    consumablesCost: 0,
    remarks: '',
  });

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const fetchHubData = async () => {
    setLoading(true);
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const binParam = context === 'store' ? '?bin=store' : (context === 'wip-jobwork' ? '?bin=wip-jobwork' : '');
      
      const [pendingRes, historyRes, scrapRes] = await Promise.allSettled([
        axios.get(`${API_BASE_URL}/api/store/mrb/pending${binParam}`, config),
        axios.get(`${API_BASE_URL}/api/store/mrb/history${binParam}`, config),
        axios.get(`${API_BASE_URL}/api/store/mrb/scrap-ledger${binParam}`, config),
      ]);

      if (pendingRes.status === 'fulfilled' && pendingRes.value.data?.data) {
        setQueue(pendingRes.value.data.data.queue || []);
      }
      if (historyRes.status === 'fulfilled' && historyRes.value.data?.data) {
        setHistoryList(historyRes.value.data.data.tickets || []);
      }
      if (scrapRes.status === 'fulfilled' && scrapRes.value.data?.data) {
        setScrapData(scrapRes.value.data.data || { scrapTickets: [], summary: {} });
      }
    } catch (err) {
      console.error('Failed to load MRB Hub data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHubData();
  }, [context]);

  // Merge all tickets (pending, history, scrap) into a unified dataset with status
  const allTickets = useMemo(() => {
    const map = new Map<string, any>();

    // 1. Add queue items (Pending action)
    queue.forEach(item => {
      const key = item._id || item.ticketNumber || String(item.sourceDocId);
      const partNo = item.partNumber || item.partNo || item.itemCode || item.materialCode || item.componentCode || '';
      map.set(key, { ...item, partNumber: partNo, status: item.status || 'Pending Disposition' });
    });

    // 2. Add history items (Actioned / In Progress / Completed)
    historyList.forEach(item => {
      const key = item._id || item.ticketNumber || String(item.sourceDocId);
      const partNo = item.partNumber || item.partNo || item.itemCode || item.materialCode || item.componentCode || '';
      map.set(key, { ...item, partNumber: partNo });
    });

    // 3. Add scrap ledger items if not already tracked
    (scrapData.scrapTickets || []).forEach((item: any) => {
      const key = item._id || item.ticketNumber || String(item.sourceDocId);
      const partNo = item.partNumber || item.partNo || item.itemCode || item.materialCode || item.componentCode || '';
      if (!map.has(key)) {
        map.set(key, { ...item, partNumber: partNo, dispositionAction: item.dispositionAction || 'Scrap & Write-Off', status: 'Completed' });
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      const dateA = new Date(a.createdAt || a.date || a.dispositionDate || 0).getTime();
      const dateB = new Date(b.createdAt || b.date || b.dispositionDate || 0).getTime();
      return dateB - dateA;
    });
  }, [queue, historyList, scrapData]);

  // Context-Scoped Tickets (Store: IncomingQC + FGQC, WIP: JobWorkQC, Quality: All)
  const contextScopedTickets = useMemo(() => {
    if (context === 'store') {
      return allTickets.filter(t => t.sourceType === 'IncomingQC' || t.sourceType === 'FGQC');
    } else if (context === 'wip-jobwork') {
      return allTickets.filter(t => t.sourceType === 'JobWorkQC');
    }
    return allTickets;
  }, [allTickets, context]);

  // Dynamic counts for category tabs
  const categoryCounts = useMemo(() => {
    if (context === 'store') {
      return {
        all: contextScopedTickets.length,
        rm: contextScopedTickets.filter(t => t.grnCategory === 'rm').length,
        bo: contextScopedTickets.filter(t => t.grnCategory === 'bo').length,
        consumable: contextScopedTickets.filter(t => t.grnCategory === 'consumable').length,
        fg: contextScopedTickets.filter(t => t.grnCategory === 'fg').length,
        pdi: contextScopedTickets.filter(t => t.grnCategory === 'pdi').length,
      };
    } else if (context === 'wip-jobwork') {
      return {
        all: contextScopedTickets.length,
        storeToWip: contextScopedTickets.filter(t => t.jobWorkType === 'store-to-wip').length,
        wipToWip: contextScopedTickets.filter(t => t.jobWorkType === 'wip-to-wip').length,
        conversion: contextScopedTickets.filter(t => t.jobWorkType === 'store-conversion').length,
      };
    }
    return { all: contextScopedTickets.length };
  }, [contextScopedTickets, context]);

  // Extract unique suppliers / vendors for the dropdown
  const uniqueSuppliers = useMemo(() => {
    const set = new Set<string>();
    contextScopedTickets.forEach(item => {
      const name = item.vendorName || item.supplierName;
      if (name && name !== 'Internal Facility' && name !== 'Shop Floor') {
        set.add(name);
      }
    });
    return Array.from(set).sort();
  }, [contextScopedTickets]);

  // Helper: check if ticket is within 24 hours of disposition
  const get24HourEditInfo = (ticket: any) => {
    if (!ticket.dispositionDate) return { isEditable: false, remainingHours: 0 };
    const elapsedMs = Date.now() - new Date(ticket.dispositionDate).getTime();
    const elapsedHours = elapsedMs / (1000 * 60 * 60);
    const isEditable = elapsedHours <= 24 && !ticket.isLocked;
    const remainingHours = Math.max(0, 24 - elapsedHours);
    return { isEditable, remainingHours };
  };

  // Filtered List based on Category, Supplier, Date/Month, Status, Defect & Search
  const currentList = useMemo(() => {
    let list = contextScopedTickets;

    // 1. Category Filter
    if (context === 'store') {
      if (storeCategory !== 'all') {
        list = list.filter(item => item.grnCategory === storeCategory);
      }
    } else if (context === 'wip-jobwork') {
      if (jwCategory !== 'all') {
        list = list.filter(item => item.jobWorkType === jwCategory);
      }
    } else {
      if (activeQcType !== 'all') {
        list = list.filter(item => item.sourceType === activeQcType);
      }
    }

    // 2. Supplier / Vendor Filter
    if (supplierFilter !== 'all') {
      list = list.filter(item => (item.vendorName || item.supplierName) === supplierFilter);
    }

    // 3. Date / Month Filter
    if (dateFilterMode === 'daily' && dateFilter) {
      list = list.filter(item => {
        const itemDate = item.createdAt || item.date || item.dispositionDate;
        return itemDate && String(itemDate).slice(0, 10) === dateFilter;
      });
    } else if (dateFilterMode === 'monthly' && monthFilter) {
      list = list.filter(item => {
        const itemDate = item.createdAt || item.date || item.dispositionDate;
        return itemDate && String(itemDate).slice(0, 7) === monthFilter;
      });
    }

    // 4. Status Filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'pending') {
        list = list.filter(item => item.status === 'Pending Disposition' || (!item.dispositionAction || item.dispositionAction === 'Pending'));
      } else if (statusFilter === 'rtv') {
        list = list.filter(item => item.dispositionAction === 'Return to Vendor');
      } else if (statusFilter === 'replacement') {
        list = list.filter(item => item.dispositionAction === 'Vendor Replacement');
      } else if (statusFilter === 'rework') {
        list = list.filter(item => item.dispositionAction?.includes('Rework'));
      } else if (statusFilter === 'scrap') {
        list = list.filter(item => item.dispositionAction === 'Scrap & Write-Off' || item.reworkDetails?.reworkScrappedQuantity > 0);
      } else if (statusFilter === 'deviation') {
        list = list.filter(item => item.dispositionAction === 'Accept on Deviation');
      }
    }

    // 5. Defect Category Filter
    if (defectFilter !== 'all') {
      list = list.filter(item => item.defectCategory === defectFilter);
    }

    // 6. Search Filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(item => {
        const matName = String(item.materialName || '').toLowerCase();
        const code = String(item.partNumber || item.partNo || item.itemCode || item.materialCode || item.componentCode || '').toLowerCase();
        const tick = String(item.ticketNumber || '').toLowerCase();
        const docNum = String(item.documentNumber || item.sourceDocNumber || '').toLowerCase();
        const vendor = String(item.vendorName || item.supplierName || '').toLowerCase();
        return matName.includes(q) || code.includes(q) || tick.includes(q) || docNum.includes(q) || vendor.includes(q);
      });
    }

    return list;
  }, [contextScopedTickets, context, storeCategory, jwCategory, activeQcType, supplierFilter, dateFilterMode, dateFilter, monthFilter, statusFilter, defectFilter, searchTerm]);

  const rejectionKpis = useMemo(() => {
    let totalRejectedTickets = currentList.length;
    let pendingActionCount = 0;
    let rtvAndReplacementCount = 0;
    let scrapAndWriteOffCount = 0;

    currentList.forEach((item: any) => {
      const isPending = !item.dispositionAction || item.dispositionAction === 'Pending' || item.status === 'Pending Disposition';
      if (isPending) {
        pendingActionCount++;
      } else if (item.dispositionAction === 'Return to Vendor' || item.dispositionAction === 'Vendor Replacement') {
        rtvAndReplacementCount++;
      } else if (item.dispositionAction === 'Scrap & Write-Off' || (item.reworkDetails?.reworkScrappedQuantity || 0) > 0) {
        scrapAndWriteOffCount++;
      }
    });

    return {
      totalRejectedTickets,
      pendingActionCount,
      rtvAndReplacementCount,
      scrapAndWriteOffCount
    };
  }, [currentList]);

  // Open Disposition Modal with presets based on QC type
  const handleOpenActionModal = (ticket: any) => {
    setSelectedTicket(ticket);
    const defaultAction = ticket.sourceType === 'IncomingQC' 
      ? 'Return to Vendor' 
      : (ticket.sourceType === 'JobWorkQC' ? 'External Rework' : 'Internal Rework');
    
    setActionType(defaultAction as any);
    setActionNotes('');
    setRtvPayload({
      challanNumber: `RET-INV-${Date.now().toString().slice(-4)}`,
      debitNoteNumber: `DN-${Date.now().toString().slice(-4)}`,
      vehicleNumber: '',
      taxRate: 18,
    });
    setReworkPayload({
      assignedWorkstation: ticket.workstation || 'Shop Floor Bench 1',
      assignedToUser: ticket.operatorName || '',
      reworkInstructions: `Rework defect: ${ticket.rejectionReason || 'Correct dimension / burr'}`,
    });
    setScrapPayload({
      scrapLocation: 'Scrap Yard Bay A',
      salvageRatePerKg: 0,
    });
    setConcessionPayload({
      deviationRefNumber: `DEV-${Date.now().toString().slice(-4)}`,
      concessionReason: 'Approved as deviation for non-critical application',
      usageConditions: 'Use As Is',
    });
  };

  // Open 24-Hour Edit Modal
  const handleOpenEditModal = (ticket: any) => {
    setEditTicket(ticket);
    setActionType(ticket.dispositionAction || 'Return to Vendor');
    setActionNotes(ticket.history?.[ticket.history.length - 1]?.notes || '');
    setRtvPayload({
      vehicleNumber: ticket.rtvDetails?.vehicleNumber || '',
      debitNoteNumber: ticket.rtvDetails?.debitNoteNumber || '',
      taxRate: ticket.taxDetails?.taxRate || 18,
    });
    setReworkPayload({
      assignedWorkstation: ticket.reworkDetails?.assignedWorkstation || 'Shop Floor Bench 1',
      assignedToUser: ticket.reworkDetails?.assignedToUser || '',
      reworkInstructions: ticket.reworkDetails?.reworkInstructions || '',
    });
    setScrapPayload({
      scrapLocation: ticket.scrapDetails?.scrapLocation || 'Scrap Yard Bay A',
      salvageRatePerKg: ticket.scrapDetails?.salvageRatePerKg || 0,
    });
    setConcessionPayload({
      deviationRefNumber: ticket.concessionDetails?.deviationRefNumber || '',
      concessionReason: ticket.concessionDetails?.concessionReason || '',
      usageConditions: ticket.concessionDetails?.usageConditions || 'Use As Is',
    });
  };

  // Submit Disposition Action
  const handleSubmitAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;

    setSubmittingAction(true);
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const payload = {
        ticketId: selectedTicket._id,
        sourceType: selectedTicket.sourceType,
        sourceDocId: selectedTicket.sourceDocId,
        sourceDocModel: selectedTicket.sourceDocModel,
        sourceDocNumber: selectedTicket.sourceDocNumber,
        materialId: selectedTicket.materialId,
        materialName: selectedTicket.materialName,
        materialCode: selectedTicket.materialCode,
        itemType: selectedTicket.itemType,
        unit: selectedTicket.unit,
        rejectedQuantity: selectedTicket.rejectedQuantity,
        unitRate: selectedTicket.unitRate,
        rejectionReason: selectedTicket.rejectionReason,
        defectCategory: selectedTicket.defectCategory,
        vendorName: selectedTicket.vendorName,
        dispositionAction: actionType,
        actionNotes,
        rtvPayload,
        reworkPayload,
        scrapPayload,
        concessionPayload,
      };

      await axios.post(`${API_BASE_URL}/api/store/mrb/disposition`, payload, config);
      setSelectedTicket(null);
      await fetchHubData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to submit disposition action');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Submit 24-Hour Edit Action
  const handleSubmitEditAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTicket) return;

    setSubmittingAction(true);
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const payload = {
        dispositionAction: actionType,
        actionNotes,
        rtvPayload,
        reworkPayload,
        scrapPayload,
        concessionPayload,
      };

      await axios.put(`${API_BASE_URL}/api/store/mrb/disposition/${editTicket._id}`, payload, config);
      setEditTicket(null);
      await fetchHubData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update disposition');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Open Rework Complete Modal
  const handleOpenReworkComplete = (ticket: any) => {
    setReworkModalTicket(ticket);
    setReworkCompleteForm({
      reworkQcStatus: 'Passed',
      passedQuantity: ticket.rejectedQuantity || 1,
      scrappedQuantity: 0,
      hoursSpent: 1,
      consumablesCost: 0,
      remarks: 'Rework successfully corrected dimensions and verified by QC',
    });
  };

  // Submit Rework Complete
  const handleSubmitReworkComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reworkModalTicket) return;

    setSubmittingAction(true);
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const payload = {
        ticketId: reworkModalTicket._id,
        reworkQcStatus: reworkCompleteForm.reworkQcStatus,
        passedQuantity: Number(reworkCompleteForm.passedQuantity),
        scrappedQuantity: Number(reworkCompleteForm.scrappedQuantity),
        hoursSpent: Number(reworkCompleteForm.hoursSpent),
        consumablesCost: Number(reworkCompleteForm.consumablesCost),
        remarks: reworkCompleteForm.remarks,
      };

      await axios.post(`${API_BASE_URL}/api/store/mrb/complete-rework`, payload, config);
      setReworkModalTicket(null);
      await fetchHubData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to complete rework');
    } finally {
      setSubmittingAction(false);
    }
  };

  const getSourceTypeBadge = (sourceType: string) => {
    switch (sourceType) {
      case 'IncomingQC':
        return { label: 'GRN Incoming QC', bg: 'bg-blue-50 text-blue-800 border-blue-200', icon: ClipboardCheck };
      case 'JobWorkQC':
        return { label: 'Job Work Return QC', bg: 'bg-amber-50 text-amber-800 border-amber-200', icon: Wrench };
      case 'FGQC':
        return { label: 'FG & PDI QC', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200', icon: CheckSquare };
      case 'ProcessQC':
        return { label: 'Shopfloor Process QC', bg: 'bg-purple-50 text-purple-800 border-purple-200', icon: Activity };
      default:
        return { label: 'QC Inspection', bg: 'bg-slate-50 text-slate-800 border-slate-200', icon: ShieldAlert };
    }
  };

  // Helper for Status Badge Display
  const renderStatusBadge = (item: any) => {
    const isPending = !item.dispositionAction || item.dispositionAction === 'Pending' || item.status === 'Pending Disposition';

    if (isPending) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-amber-50 text-amber-800 border border-amber-200 block w-fit">
          🟡 Pending Action
        </span>
      );
    }

    switch (item.dispositionAction) {
      case 'Return to Vendor':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-rose-50 text-rose-800 border border-rose-200 block w-fit">
            🔵 Return to Vendor (Debit Note)
          </span>
        );
      case 'Vendor Replacement':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-blue-50 text-blue-800 border border-blue-200 block w-fit">
            🟣 Replacement DC
          </span>
        );
      case 'External Rework':
      case 'Internal Rework':
        return (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border block w-fit ${
            item.status === 'Completed' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-indigo-50 text-indigo-800 border-indigo-200'
          }`}>
            🟠 {item.dispositionAction} ({item.status})
          </span>
        );
      case 'Scrap & Write-Off':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-slate-100 text-slate-800 border border-slate-300 block w-fit">
            🔴 Scrapped & Written Off
          </span>
        );
      case 'Accept on Deviation':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-emerald-50 text-emerald-800 border border-emerald-200 block w-fit">
            🟢 Approved on Deviation
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-slate-50 text-slate-700 border border-slate-200 block w-fit">
            {item.dispositionAction || item.status}
          </span>
        );
    }
  };

  const handleDownloadSCNPDF = (item: any) => {
    const rejectedQty = Number(item.rejectedQuantity || 0);
    const acceptedQty = Number(item.acceptedQuantity || 0);
    const receivedQty = Number(item.receivedQuantity || (rejectedQty + acceptedQty) || 1);

    generateSCNPDF({
      scnNumber: item.ticketNumber || `SCN-${item.documentNumber || item.sourceDocNumber || 'QC'}`,
      inspectionDate: item.date || item.createdAt || new Date(),
      grnNumber: item.grnNumber || item.sourceDocNumber || item.documentNumber,
      grnDate: item.grnDate || item.date || item.createdAt,
      poReference: item.poReference || '',
      invoiceNumber: item.invoiceNumber || '',
      challanNumber: item.challanNumber || '',
      supplierName: item.vendorName || item.supplierName || 'Supplier / Vendor',
      items: [
        {
          materialName: item.materialName || 'Material Item',
          unit: item.unit || 'PCS',
          receivedQuantity: receivedQty,
          inspectedQuantity: receivedQty,
          acceptedQuantity: acceptedQty,
          rejectedQuantity: rejectedQty,
          rejectionReason: item.rejectionReason || 'Quality Defect',
          defectCategory: item.defectCategory || 'Dimensional Deviation',
          disposition: item.dispositionAction && item.dispositionAction !== 'Pending' ? item.dispositionAction : 'Rejected - Sent to MRB',
          overallStatus: 'Rejected',
          remarks: item.dispositionNotes || item.rejectionReason || ''
        }
      ],
      overallRemarks: `Store Clearance Note (SCN) Rejection Certificate. ${item.rejectionReason ? `Reason: ${item.rejectionReason}` : ''}`
    });
  };

  return (
    <div className="space-y-2.5 font-sans">
      {/* Executive KPI Dashboard */}
      {!showDashboard ? (
        /* Collapsed Single-Line Summary Bar */
        <div className="bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/90 shadow-2xs flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center flex-wrap gap-2.5 sm:gap-4 text-slate-600">
            <span className="font-semibold text-slate-800 flex items-center gap-1.5">
              <ShieldAlert size={14} className="text-rose-600" />
              Total Rejected: <strong className="text-rose-600 font-mono">{rejectionKpis.totalRejectedTickets}</strong>
            </span>
            <span className="text-slate-300">|</span>
            <span>
              Pending Action: <strong className="text-amber-600 font-mono">{rejectionKpis.pendingActionCount}</strong>
            </span>
            <span className="text-slate-300">|</span>
            <span>
              RTV & Replacement: <strong className="text-blue-600 font-mono">{rejectionKpis.rtvAndReplacementCount}</strong>
            </span>
            <span className="text-slate-300">|</span>
            <span>
              Scrapped / Written Off: <strong className="text-slate-700 font-mono">{rejectionKpis.scrapAndWriteOffCount}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowDashboard(true)}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <span>Show Dashboard</span>
            <ChevronDown size={14} />
          </button>
        </div>
      ) : (
        /* Expanded 4 KPI Cards */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Total Rejections */}
          <div className="bg-gradient-to-br from-rose-50/90 via-white to-slate-50 p-3.5 rounded-2xl border border-rose-100 shadow-2xs relative overflow-hidden">
            <div className="flex items-center justify-between text-rose-600 mb-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Total Rejected Records</span>
              <div className="w-7 h-7 rounded-xl bg-rose-100 flex items-center justify-center">
                <ShieldAlert size={15} />
              </div>
            </div>
            <div className="text-xl font-black text-slate-900 font-mono tracking-tight">
              {rejectionKpis.totalRejectedTickets} <span className="text-xs font-semibold text-slate-500 font-sans">Tickets</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
              <span>MRB Store Queue</span>
              <span className="font-bold text-rose-600 font-mono">Defect Items</span>
            </div>
          </div>

          {/* Card 2: Pending Disposition */}
          <div className="bg-gradient-to-br from-amber-50/90 via-white to-slate-50 p-3.5 rounded-2xl border border-amber-100 shadow-2xs relative overflow-hidden">
            <div className="flex items-center justify-between text-amber-600 mb-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Pending Action</span>
              <div className="w-7 h-7 rounded-xl bg-amber-100 flex items-center justify-center">
                <Clock size={15} />
              </div>
            </div>
            <div className="text-xl font-black text-slate-900 font-mono tracking-tight">
              {rejectionKpis.pendingActionCount} <span className="text-xs font-semibold text-slate-500 font-sans">Awaiting</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
              <span>Awaiting Disposition</span>
              <span className="font-bold text-amber-600 font-mono">
                {rejectionKpis.pendingActionCount > 0 ? "Action Required" : "Queue Clear"}
              </span>
            </div>
          </div>

          {/* Card 3: RTV & Replacement */}
          <div className="bg-gradient-to-br from-blue-50/90 via-white to-slate-50 p-3.5 rounded-2xl border border-blue-100 shadow-2xs relative overflow-hidden">
            <div className="flex items-center justify-between text-blue-600 mb-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">RTV & Replacement</span>
              <div className="w-7 h-7 rounded-xl bg-blue-100 flex items-center justify-center">
                <Truck size={15} />
              </div>
            </div>
            <div className="text-xl font-black text-slate-900 font-mono tracking-tight">
              {rejectionKpis.rtvAndReplacementCount} <span className="text-xs font-semibold text-slate-500 font-sans">Vendor Returns</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
              <span>Debit Notes / Replacement DCs</span>
              <span className="font-bold text-blue-600 font-mono">Dispatched</span>
            </div>
          </div>

          {/* Card 4: Scrapped / Written Off */}
          <div className="bg-gradient-to-br from-slate-100/90 via-white to-slate-50 p-3.5 rounded-2xl border border-slate-200 shadow-2xs relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-700 mb-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Scrap & Write-Off</span>
              <div className="w-7 h-7 rounded-xl bg-slate-100 flex items-center justify-center">
                <Trash2 size={15} />
              </div>
            </div>
            <div className="text-xl font-black text-slate-900 font-mono tracking-tight">
              {rejectionKpis.scrapAndWriteOffCount} <span className="text-xs font-semibold text-slate-500 font-sans">Tickets</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
              <span>Scrap Ledger Status</span>
              <span className="font-bold text-slate-700 font-mono">Written Off</span>
            </div>
          </div>
        </div>
      )}

      {/* 1. Category Switcher Tabs with Refresh Button at Last Position */}
      {context === 'store' ? (
        /* Store Inventory: Strictly 5 GRN & Inward Types */
        <div className="bg-white p-1.5 rounded-xl border border-slate-200/90 shadow-2xs flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto no-scrollbar scroll-smooth touch-pan-x py-0.5">
            {[
              { id: 'all', label: 'All GRN Rejections', count: categoryCounts.all },
              { id: 'rm', label: 'Raw Materials (RM)', count: categoryCounts.rm },
              { id: 'bo', label: 'Bought-Out (BO)', count: categoryCounts.bo },
              { id: 'consumable', label: 'Consumables', count: categoryCounts.consumable },
              { id: 'fg', label: 'Finished Goods (FG)', count: categoryCounts.fg },
              { id: 'pdi', label: 'PDI Inspection', count: categoryCounts.pdi },
            ].map(tab => {
              const isSel = storeCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setStoreCategory(tab.id as any)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                    isSel
                      ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-2xs'
                      : 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-100 text-slate-700 font-medium'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono font-bold ${
                    isSel ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Dashboard Show/Hide Toggle */}
            <button
              type="button"
              onClick={() => setShowDashboard(!showDashboard)}
              className="px-2.5 sm:px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs shrink-0"
              title={showDashboard ? "Hide executive dashboard" : "Show executive dashboard"}
            >
              {showDashboard ? <LayoutGrid size={13} className="text-indigo-600" /> : <Eye size={13} className="text-slate-500" />}
              <span className="hidden sm:inline">{showDashboard ? "Hide Dashboard" : "Show Dashboard"}</span>
            </button>

            {/* Refresh Button at Tab Last Position */}
            <button
              onClick={fetchHubData}
              disabled={loading}
              className="px-2.5 sm:px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs shrink-0"
              title="Refresh Rejection Records"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      ) : context === 'wip-jobwork' ? (
        /* WIP Job Work: Strictly 3 Returnable DC Types */
        <div className="bg-white p-1.5 rounded-xl border border-slate-200/90 shadow-2xs flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto no-scrollbar scroll-smooth touch-pan-x py-0.5">
            {[
              { id: 'all', label: 'All Returnable DCs', count: categoryCounts.all },
              { id: 'store-to-wip', label: 'Store to WIP DC', count: categoryCounts.storeToWip },
              { id: 'wip-to-wip', label: 'WIP to WIP DC', count: categoryCounts.wipToWip },
              { id: 'store-conversion', label: 'Standard & Assembly DC', count: categoryCounts.conversion },
            ].map(tab => {
              const isSel = jwCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setJwCategory(tab.id as any)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                    isSel
                      ? 'bg-amber-50 border-amber-500 text-amber-900 font-bold shadow-2xs'
                      : 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-100 text-slate-700 font-medium'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono font-bold ${
                    isSel ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Refresh Button at Tab Last Position */}
          <button
            onClick={fetchHubData}
            disabled={loading}
            className="px-2.5 sm:px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs shrink-0"
            title="Refresh Rejection Records"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      ) : (
        /* Quality Master Context */
        <div className="bg-white p-1.5 rounded-xl border border-slate-200/90 shadow-2xs flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto no-scrollbar scroll-smooth touch-pan-x py-0.5">
            {[
              { id: 'all', label: 'All QC Sources', icon: Layers, count: allTickets.length },
              { id: 'IncomingQC', label: 'Incoming QC', icon: ClipboardCheck, count: allTickets.filter(t => t.sourceType === 'IncomingQC').length },
              { id: 'ProcessQC', label: 'Process QC', icon: Activity, count: allTickets.filter(t => t.sourceType === 'ProcessQC').length },
              { id: 'JobWorkQC', label: 'Job Work QC', icon: Wrench, count: allTickets.filter(t => t.sourceType === 'JobWorkQC').length },
              { id: 'FGQC', label: 'FG & PDI QC', icon: CheckSquare, count: allTickets.filter(t => t.sourceType === 'FGQC').length },
            ].map(tab => {
              const Icon = tab.icon;
              const isSel = activeQcType === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveQcType(tab.id as any)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                    isSel
                      ? 'bg-blue-50 border-blue-500 text-blue-900 font-bold shadow-2xs'
                      : 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-100 text-slate-700 font-medium'
                  }`}
                >
                  <Icon size={13} className={isSel ? 'text-blue-600' : 'text-slate-400'} />
                  <span>{tab.label}</span>
                  <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono font-bold ${
                    isSel ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            onClick={fetchHubData}
            disabled={loading}
            className="px-2.5 sm:px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs shrink-0"
            title="Refresh Rejection Records"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      )}

      {/* 2. Responsive Filter Toolbar: Desktop inline + Mobile Collapsible */}
      <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-slate-200/90 shadow-2xs">
        {/* Desktop View (md:flex) */}
        <div className="hidden md:flex flex-wrap items-center justify-between gap-2">
          {/* Left Side Controls: Search, Supplier, Status, Defect */}
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[170px] max-w-xs">
              <Search className="absolute left-2.5 top-2 text-slate-400" size={13} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search material or doc #..."
                className="w-full pl-7 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-800 focus:bg-white focus:border-blue-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Supplier-wise Filter */}
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 outline-none cursor-pointer focus:bg-white focus:border-blue-500 max-w-[200px]"
            >
              <option value="all">All Suppliers / Vendors</option>
              {uniqueSuppliers.map(sup => (
                <option key={sup} value={sup}>{sup}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 outline-none cursor-pointer focus:bg-white focus:border-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending Action</option>
              <option value="rtv">Return to Vendor (Debit Note)</option>
              <option value="replacement">Vendor Replacement</option>
              <option value="rework">Rework</option>
              <option value="scrap">Scrapped & Written Off</option>
              <option value="deviation">Approved on Deviation</option>
            </select>

            {/* Defect Category Filter */}
            <select
              value={defectFilter}
              onChange={(e) => setDefectFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 outline-none cursor-pointer focus:bg-white focus:border-blue-500"
            >
              <option value="all">All Defects</option>
              <option value="Dimensional Deviation">Dimensional</option>
              <option value="Visual / Surface Defect">Visual / Surface</option>
              <option value="Material Chemical / Hardness Failure">Chemical / Hardness</option>
              <option value="Machining Defect / Burr">Machining / Burr</option>
              <option value="Subcontractor Flaw">Subcontractor Flaw</option>
            </select>

            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer underline px-1"
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Right Side: Date-wise and Month-wise Filter Controls */}
          <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-lg border border-slate-200">
            <div className="flex items-center gap-0.5 text-xs font-semibold">
              <button
                onClick={() => { setDateFilterMode('all'); setDateFilter(''); setMonthFilter(''); }}
                className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer transition-all ${
                  dateFilterMode === 'all' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                All Dates
              </button>
              <button
                onClick={() => setDateFilterMode('daily')}
                className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer transition-all ${
                  dateFilterMode === 'daily' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Day
              </button>
              <button
                onClick={() => setDateFilterMode('monthly')}
                className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer transition-all ${
                  dateFilterMode === 'monthly' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Month
              </button>
            </div>

            {dateFilterMode === 'daily' && (
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="h-7 px-2 text-[11px] bg-white border border-slate-200 rounded text-slate-800 font-mono outline-none"
              />
            )}

            {dateFilterMode === 'monthly' && (
              <input
                type="month"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="h-7 px-2 text-[11px] bg-white border border-slate-200 rounded text-slate-800 font-mono outline-none"
              />
            )}
          </div>
        </div>

        {/* Mobile View (md:hidden) */}
        <div className="md:hidden flex flex-col gap-2">
          {/* Top Row: Search Input + Filters Toggle Button */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-2 text-slate-400" size={13} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search material or doc #..."
                className="w-full pl-7 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-800 focus:bg-white focus:border-blue-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowMobileFilters(prev => !prev)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                showMobileFilters || activeFilterCount > 0
                  ? 'bg-blue-50 border-blue-500 text-blue-800 shadow-2xs'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <SlidersHorizontal size={13} />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
              {showMobileFilters ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>

          {/* Active Filter Chips (if any active filter) */}
          {(activeFilterCount > 0 || searchTerm) && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth touch-pan-x py-0.5">
              {supplierFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-blue-50 text-blue-800 border border-blue-200 shrink-0">
                  <span>Vendor: {supplierFilter}</span>
                  <button onClick={() => setSupplierFilter('all')} className="hover:text-blue-900 cursor-pointer">
                    <X size={11} />
                  </button>
                </span>
              )}
              {statusFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-indigo-50 text-indigo-800 border border-indigo-200 shrink-0">
                  <span>Status: {statusFilter}</span>
                  <button onClick={() => setStatusFilter('all')} className="hover:text-indigo-900 cursor-pointer">
                    <X size={11} />
                  </button>
                </span>
              )}
              {defectFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-rose-50 text-rose-800 border border-rose-200 shrink-0">
                  <span>Defect: {defectFilter}</span>
                  <button onClick={() => setDefectFilter('all')} className="hover:text-rose-900 cursor-pointer">
                    <X size={11} />
                  </button>
                </span>
              )}
              {dateFilterMode !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                  <span>Date: {dateFilter || monthFilter || dateFilterMode}</span>
                  <button onClick={() => { setDateFilterMode('all'); setDateFilter(''); setMonthFilter(''); }} className="hover:text-amber-900 cursor-pointer">
                    <X size={11} />
                  </button>
                </span>
              )}
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-[10px] text-rose-600 hover:text-rose-800 font-bold underline cursor-pointer shrink-0 ml-1"
              >
                Clear all
              </button>
            </div>
          )}

          {/* Expandable Mobile Filters Panel */}
          {showMobileFilters && (
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2.5 mt-1 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Supplier / Vendor
                  </label>
                  <select
                    value={supplierFilter}
                    onChange={(e) => setSupplierFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-medium text-slate-700 outline-none"
                  >
                    <option value="all">All Suppliers / Vendors</option>
                    {uniqueSuppliers.map(sup => (
                      <option key={sup} value={sup}>{sup}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Disposition Status
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-medium text-slate-700 outline-none"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending Action</option>
                    <option value="rtv">Return to Vendor (Debit Note)</option>
                    <option value="replacement">Vendor Replacement</option>
                    <option value="rework">Rework</option>
                    <option value="scrap">Scrapped & Written Off</option>
                    <option value="deviation">Approved on Deviation</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Defect Classification
                  </label>
                  <select
                    value={defectFilter}
                    onChange={(e) => setDefectFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-medium text-slate-700 outline-none"
                  >
                    <option value="all">All Defects</option>
                    <option value="Dimensional Deviation">Dimensional</option>
                    <option value="Visual / Surface Defect">Visual / Surface</option>
                    <option value="Material Chemical / Hardness Failure">Chemical / Hardness</option>
                    <option value="Machining Defect / Burr">Machining / Burr</option>
                    <option value="Subcontractor Flaw">Subcontractor Flaw</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Date Range Filter
                  </label>
                  <div className="flex items-center gap-1">
                    <div className="flex items-center gap-0.5 bg-white p-0.5 rounded border border-slate-200">
                      <button
                        type="button"
                        onClick={() => { setDateFilterMode('all'); setDateFilter(''); setMonthFilter(''); }}
                        className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer ${
                          dateFilterMode === 'all' ? 'bg-blue-50 text-blue-800' : 'text-slate-500'
                        }`}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => setDateFilterMode('daily')}
                        className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer ${
                          dateFilterMode === 'daily' ? 'bg-blue-50 text-blue-800' : 'text-slate-500'
                        }`}
                      >
                        Day
                      </button>
                      <button
                        type="button"
                        onClick={() => setDateFilterMode('monthly')}
                        className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer ${
                          dateFilterMode === 'monthly' ? 'bg-blue-50 text-blue-800' : 'text-slate-500'
                        }`}
                      >
                        Month
                      </button>
                    </div>

                    {dateFilterMode === 'daily' && (
                      <input
                        type="date"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="flex-1 h-7 px-2 text-[11px] bg-white border border-slate-200 rounded text-slate-800 font-mono outline-none"
                      />
                    )}

                    {dateFilterMode === 'monthly' && (
                      <input
                        type="month"
                        value={monthFilter}
                        onChange={(e) => setMonthFilter(e.target.value)}
                        className="flex-1 h-7 px-2 text-[11px] bg-white border border-slate-200 rounded text-slate-800 font-mono outline-none"
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-200/70">
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="text-xs text-rose-600 font-semibold cursor-pointer hover:underline"
                >
                  Reset All Filters
                </button>
                <button
                  type="button"
                  onClick={() => setShowMobileFilters(false)}
                  className="px-3 py-1 bg-blue-600 text-white rounded-md text-xs font-bold cursor-pointer"
                >
                  Apply & Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Pure Light Unified Table */}
      <div className="bg-white border border-slate-200/90 rounded-xl shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-400">
            <RefreshCw className="animate-spin mx-auto mb-2 opacity-50" size={20} />
            <p className="text-xs font-semibold">Loading rejection records...</p>
          </div>
        ) : currentList.length === 0 ? (
          <div className="p-10 text-center text-slate-400 space-y-1.5">
            <CheckCircle2 className="mx-auto text-emerald-500 opacity-60" size={28} />
            <h4 className="text-sm font-bold text-slate-700">
              No rejection records match this filter
            </h4>
            <p className="text-xs text-slate-500">Try changing the category, supplier, date, or clear your search term.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)] min-h-[350px]">
              <table className="w-full text-xs text-left">
                <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-xs text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px] shadow-2xs">
                  <tr>
                    <th className="px-3.5 py-2.5">QC Phase / Doc #</th>
                    <th className="px-3.5 py-2.5">Material & Technical Description</th>
                    <th className="px-3.5 py-2.5 text-center">Defect Qty</th>
                    <th className="px-3.5 py-2.5">Defect Reason & Root Cause</th>
                    <th className="px-3.5 py-2.5">Supplier / Origin</th>
                    <th className="px-3.5 py-2.5">Status</th>
                    <th className="px-3.5 py-2.5 text-right">Actions & Documents</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {currentList.map((item, idx) => {
                    const qty = Number(item.rejectedQuantity || item.reworkDetails?.reworkScrappedQuantity || 0);
                    const badge = getSourceTypeBadge(item.sourceType);
                    const BadgeIcon = badge.icon;
                    const { isEditable, remainingHours } = get24HourEditInfo(item);
                    const techDesc = item.technicalDescription || item.description || item.descriptions || item.materialDescription;
                    const isPending = !item.dispositionAction || item.dispositionAction === 'Pending' || item.status === 'Pending Disposition';
                    const partNo = item.partNumber || item.partNo || item.itemCode || item.materialCode || item.componentCode;

                    return (
                      <tr key={item._id || idx} className="hover:bg-slate-50/70 transition-colors">
                        {/* QC Phase & Document */}
                        <td className="px-3.5 py-2.5 align-top">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border flex items-center gap-1 w-fit ${badge.bg}`}>
                            <BadgeIcon size={11} />
                            {badge.label}
                          </span>
                          <span className="font-mono text-[11px] font-bold text-slate-700 block mt-1">
                            {item.documentNumber || item.sourceDocNumber || item.ticketNumber}
                          </span>
                          {item.jobWorkType && (
                            <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 block w-fit mt-0.5">
                              {item.jobWorkType}
                            </span>
                          )}
                        </td>

                        {/* Material & Description (Strict AGENTS.md with prominent Part Number) */}
                        <td className="px-3.5 py-2.5 align-top max-w-[280px]">
                          <div className="font-bold text-slate-900 text-xs sm:text-sm">
                            {item.materialName || "Material Item"}
                          </div>
                          {techDesc ? (
                            <div className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-2">
                              {techDesc}
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-400 mt-0.5 italic">
                              No technical description recorded
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            {partNo && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-mono font-bold bg-indigo-50 text-indigo-800 border border-indigo-200/80 shadow-2xs" title="Item Part Number">
                                <span className="text-[9px] font-sans font-semibold text-indigo-500 uppercase tracking-wide">Part No:</span>
                                <span>{partNo}</span>
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400 font-medium">
                              Category: {item.itemType || item.grnCategory?.toUpperCase() || 'Material'}
                            </span>
                          </div>
                        </td>

                        {/* Defect Qty */}
                        <td className="px-3.5 py-2.5 align-top text-center">
                          <span className="px-2 py-0.5 bg-rose-50 text-rose-700 font-mono font-bold text-xs rounded-md border border-rose-200 block w-fit mx-auto">
                            {qty} {item.unit || 'KG'}
                          </span>
                          {item.unitRate > 0 && (
                            <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                              ₹{(qty * item.unitRate).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </span>
                          )}
                        </td>

                        {/* Defect Reason */}
                        <td className="px-3.5 py-2.5 align-top max-w-[200px]">
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded font-semibold text-[10px] block w-fit mb-0.5">
                            {item.defectCategory || 'Inspection Defect'}
                          </span>
                          <p className="text-[11px] text-slate-600 line-clamp-2" title={item.rejectionReason}>
                            {item.rejectionReason || 'Quality non-conformance'}
                          </p>
                        </td>

                        {/* Origin / Supplier */}
                        <td className="px-3.5 py-2.5 align-top">
                          <div className="font-semibold text-slate-800 text-xs">
                            {item.vendorName || item.supplierName || item.workstation || 'Internal Facility'}
                          </div>
                          {item.scrapDetails?.scrapLocation && (
                            <span className="text-[10px] font-mono text-rose-600 block">Bay: {item.scrapDetails.scrapLocation}</span>
                          )}
                          <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                            {new Date(item.createdAt || item.date || item.dispositionDate || Date.now()).toLocaleDateString('en-GB')}
                          </span>
                        </td>

                        {/* Prominent Status Display */}
                        <td className="px-3.5 py-2.5 align-top">
                          {renderStatusBadge(item)}

                          {/* 24-Hour Edit Window Indicator */}
                          {item.dispositionDate && (
                            <div className="mt-1">
                              {isEditable ? (
                                <span className="text-[9.5px] font-mono text-amber-700 flex items-center gap-1 font-semibold">
                                  <Clock size={10} /> {remainingHours.toFixed(1)}h edit window
                                </span>
                              ) : (
                                <span className="text-[9.5px] font-mono text-slate-400 flex items-center gap-1">
                                  <Lock size={10} /> Locked
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Actions & Documents */}
                        <td className="px-3.5 py-2.5 align-top text-right space-y-1">
                          {isPending ? (
                            <button
                              onClick={() => handleOpenActionModal(item)}
                              className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-2xs transition-all cursor-pointer text-[11px] flex items-center gap-1 ml-auto"
                            >
                              <span>Action</span>
                              <ArrowRight size={12} />
                            </button>
                          ) : item.dispositionAction?.includes('Rework') && item.status === 'In Progress' ? (
                            <button
                              onClick={() => handleOpenReworkComplete(item)}
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-2xs transition-all cursor-pointer text-[11px] flex items-center gap-1 ml-auto"
                            >
                              <CheckCheck size={12} />
                              <span>Complete QC</span>
                            </button>
                          ) : null}

                          {/* 24-Hour Edit Action */}
                          {isEditable && (
                            <button
                              onClick={() => handleOpenEditModal(item)}
                              className="px-2 py-1 bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300 rounded text-[10px] font-semibold flex items-center gap-1 cursor-pointer ml-auto"
                            >
                              <Edit3 size={10} />
                              <span>Edit ({remainingHours.toFixed(0)}h)</span>
                            </button>
                          )}

                          {/* Download Document Passes */}
                          <div className="flex items-center justify-end gap-1 flex-wrap pt-0.5">
                            {/* SCN Inspection PDF Certificate */}
                            {(item.sourceType === 'IncomingQC' || item.sourceType === 'FGQC' || item.grnNumber || context === 'store') && (
                              <button
                                onClick={() => handleDownloadSCNPDF(item)}
                                className="px-1.5 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                title="Download Store Clearance Note (SCN) PDF"
                              >
                                <FileText size={10} />
                                <span>SCN PDF</span>
                              </button>
                            )}

                            {/* Original Scanned Invoice / Delivery Challan Document */}
                            {item.originalScannedPdf && (
                              <a
                                href={item.originalScannedPdf}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                title="View Original Scanned Vendor Bill / Delivery Challan PDF"
                              >
                                <Eye size={10} />
                                <span>Scanned Doc</span>
                              </a>
                            )}

                            {item.dispositionAction === 'Return to Vendor' && (
                              <button
                                onClick={() => generateReturnInvoicePDF(item)}
                                className="px-1.5 py-0.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                                title="Download GST Debit Note / Return Bill"
                              >
                                <Download size={10} />
                                <span>Debit Note</span>
                              </button>
                            )}

                            {item.dispositionAction === 'Vendor Replacement' && (
                              <button
                                onClick={() => generateReplacementDcPDF(item)}
                                className="px-1.5 py-0.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                                title="Download Replacement Delivery Challan"
                              >
                                <Download size={10} />
                                <span>DC Pass</span>
                              </button>
                            )}

                            {(item.dispositionAction === 'Scrap & Write-Off' || item.reworkDetails?.reworkScrappedQuantity > 0) && (
                              <button
                                onClick={() => generateScrapCertificatePDF(item)}
                                className="px-1.5 py-0.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                                title="Download Scrap Certificate"
                              >
                                <Download size={10} />
                                <span>Scrap Cert</span>
                              </button>
                            )}

                            {item.dispositionAction && item.dispositionAction !== 'Pending' && (
                              <button
                                onClick={() => generateMRBCorrectiveActionPDF(item)}
                                className="px-1.5 py-0.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                                title="Download Action Sheet"
                              >
                                <Printer size={10} />
                                <span>Report</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View (Strict AGENTS.md Compliance with pb-28 for bottom bar) */}
            <div className="block md:hidden max-h-[calc(100vh-270px)] overflow-y-auto p-2.5 sm:p-3 space-y-3 pb-28 sm:pb-20 bg-slate-50/50">
              {currentList.map((item, idx) => {
                const qty = Number(item.rejectedQuantity || item.reworkDetails?.reworkScrappedQuantity || 0);
                const badge = getSourceTypeBadge(item.sourceType);
                const BadgeIcon = badge.icon;
                const { isEditable, remainingHours } = get24HourEditInfo(item);
                const techDesc = item.technicalDescription || item.description || item.descriptions || item.materialDescription;
                const isPending = !item.dispositionAction || item.dispositionAction === 'Pending' || item.status === 'Pending Disposition';
                const partNo = item.partNumber || item.partNo || item.itemCode || item.materialCode || item.componentCode;

                return (
                  <div
                    key={item._id || idx}
                    className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col gap-2.5 transition-all hover:border-slate-300"
                  >
                    {/* Card Header: Doc #, QC Phase badge, Status */}
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border flex items-center gap-1 shrink-0 ${badge.bg}`}>
                            <BadgeIcon size={11} />
                            {badge.label}
                          </span>
                          <span className="font-mono text-xs font-bold text-slate-800 truncate">
                            {item.documentNumber || item.sourceDocNumber || item.ticketNumber}
                          </span>
                        </div>
                        {item.jobWorkType && (
                          <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 block w-fit mt-1">
                            {item.jobWorkType}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col items-end shrink-0 gap-1">
                        {renderStatusBadge(item)}
                        {item.dispositionDate && (
                          isEditable ? (
                            <span className="text-[9.5px] font-mono text-amber-700 flex items-center gap-1 font-semibold">
                              <Clock size={10} /> {remainingHours.toFixed(1)}h edit
                            </span>
                          ) : (
                            <span className="text-[9.5px] font-mono text-slate-400 flex items-center gap-1">
                              <Lock size={10} /> Locked
                            </span>
                          )
                        )}
                      </div>
                    </div>

                    {/* Material & Description - Strictly AGENTS.md compliant */}
                    <div>
                      <div className="font-bold text-slate-900 text-sm">
                        {item.materialName || "Material Item"}
                      </div>
                      {techDesc ? (
                        <div className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-2">
                          {techDesc}
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-400 mt-0.5 italic">
                          No technical description recorded
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        {partNo && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-mono font-bold bg-indigo-50 text-indigo-800 border border-indigo-200/80 shadow-2xs" title="Item Part Number">
                            <span className="text-[9px] font-sans font-semibold text-indigo-500 uppercase tracking-wide">Part No:</span>
                            <span>{partNo}</span>
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 font-medium">
                          Category: {item.itemType || item.grnCategory?.toUpperCase() || 'Material'}
                        </span>
                      </div>
                    </div>

                    {/* Key Details Grid: Defect Qty, Origin, Defect Reason */}
                    <div className="grid grid-cols-2 gap-2 bg-slate-50/80 p-2.5 rounded-lg border border-slate-100 text-xs">
                      <div>
                        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide block">Defect Quantity</span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="font-bold text-rose-700 font-mono text-sm">
                            {qty} {item.unit || 'KG'}
                          </span>
                          {item.unitRate > 0 && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              (₹{(qty * item.unitRate).toLocaleString('en-IN', { maximumFractionDigits: 0 })})
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide block">Origin / Vendor</span>
                        <span className="font-semibold text-slate-800 text-xs truncate block mt-0.5" title={item.vendorName || item.supplierName}>
                          {item.vendorName || item.supplierName || item.workstation || 'Internal Facility'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono block">
                          {new Date(item.createdAt || item.date || item.dispositionDate || Date.now()).toLocaleDateString('en-GB')}
                        </span>
                      </div>

                      <div className="col-span-2 pt-1.5 border-t border-slate-200/60">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[9.5px] font-bold uppercase tracking-wide px-1.5 py-0.2 bg-slate-200/80 text-slate-700 rounded">
                            {item.defectCategory || 'Inspection Defect'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 line-clamp-2">
                          {item.rejectionReason || 'Quality non-conformance'}
                        </p>
                      </div>
                    </div>

                    {/* Action Buttons & Documents */}
                    <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                      {/* Primary Action Button */}
                      {isPending ? (
                        <button
                          onClick={() => handleOpenActionModal(item)}
                          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-2xs transition-all cursor-pointer text-xs flex items-center justify-center gap-1.5"
                        >
                          <span>Action Pathway</span>
                          <ArrowRight size={13} />
                        </button>
                      ) : item.dispositionAction?.includes('Rework') && item.status === 'In Progress' ? (
                        <button
                          onClick={() => handleOpenReworkComplete(item)}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-2xs transition-all cursor-pointer text-xs flex items-center justify-center gap-1.5"
                        >
                          <CheckCheck size={14} />
                          <span>Complete QC Clearance</span>
                        </button>
                      ) : null}

                      {/* Edit button if within 24h */}
                      {isEditable && (
                        <button
                          onClick={() => handleOpenEditModal(item)}
                          className="w-full py-1.5 bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Edit3 size={12} />
                          <span>Edit Action ({remainingHours.toFixed(0)}h remaining)</span>
                        </button>
                      )}

                      {/* Download Document Passes */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {(item.sourceType === 'IncomingQC' || item.sourceType === 'FGQC' || item.grnNumber || context === 'store') && (
                          <button
                            onClick={() => handleDownloadSCNPDF(item)}
                            className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                            title="Download Store Clearance Note (SCN) PDF"
                          >
                            <FileText size={11} />
                            <span>SCN PDF</span>
                          </button>
                        )}

                        {item.originalScannedPdf && (
                          <a
                            href={item.originalScannedPdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                            title="View Original Scanned Vendor Bill / Delivery Challan PDF"
                          >
                            <Eye size={11} />
                            <span>Scanned Doc</span>
                          </a>
                        )}

                        {item.dispositionAction === 'Return to Vendor' && (
                          <button
                            onClick={() => generateReturnInvoicePDF(item)}
                            className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                            title="Download GST Debit Note / Return Bill"
                          >
                            <Download size={11} />
                            <span>Debit Note</span>
                          </button>
                        )}

                        {item.dispositionAction === 'Vendor Replacement' && (
                          <button
                            onClick={() => generateReplacementDcPDF(item)}
                            className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                            title="Download Replacement Delivery Challan"
                          >
                            <Download size={11} />
                            <span>DC Pass</span>
                          </button>
                        )}

                        {(item.dispositionAction === 'Scrap & Write-Off' || item.reworkDetails?.reworkScrappedQuantity > 0) && (
                          <button
                            onClick={() => generateScrapCertificatePDF(item)}
                            className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                            title="Download Scrap Certificate"
                          >
                            <Download size={11} />
                            <span>Scrap Cert</span>
                          </button>
                        )}

                        {item.dispositionAction && item.dispositionAction !== 'Pending' && (
                          <button
                            onClick={() => generateMRBCorrectiveActionPDF(item)}
                            className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                            title="Download Action Sheet"
                          >
                            <Printer size={11} />
                            <span>Report</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* 4. Action Disposition Modal */}
      <AnimatePresence>
        {selectedTicket && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white w-full max-w-2xl rounded-xl shadow-xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col"
            >
              <div className="p-3.5 sm:p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center shrink-0">
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {selectedTicket.sourceType === 'JobWorkQC' ? 'Job Work QC Action' : 'Store GRN QC Action'}
                  </span>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 mt-1">
                    Disposition: {selectedTicket.materialName} ({selectedTicket.rejectedQuantity} {selectedTicket.unit})
                  </h3>
                  {(selectedTicket.partNumber || selectedTicket.partNo || selectedTicket.materialCode || selectedTicket.itemCode) && (
                    <div className="text-[11px] font-mono font-bold text-indigo-700 mt-0.5 flex items-center gap-1">
                      <span className="text-[9px] font-sans text-slate-500 uppercase font-semibold">Part No:</span>
                      <span>{selectedTicket.partNumber || selectedTicket.partNo || selectedTicket.materialCode || selectedTicket.itemCode}</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  <XCircle size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmitAction} className="p-3.5 sm:p-4 space-y-3.5 text-xs overflow-y-auto flex-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Select Action Pathway:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {[
                      { id: 'Return to Vendor', label: '1. Return Bill (RTV)', desc: 'Tax Return Bill + Debit Note', icon: Truck },
                      { id: 'Vendor Replacement', label: '2. Replacement DC', desc: 'Warranty Replacement Challan', icon: RotateCcw },
                      { id: 'External Rework', label: '3. Subcontractor Rework', desc: 'FOC Rework Delivery Challan', icon: Wrench },
                      { id: 'Internal Rework', label: '4. Internal Rework', desc: 'Shopfloor Correction Routing', icon: ToolIcon },
                      { id: 'Scrap & Write-Off', label: '5. Scrap Bin', desc: 'Scrap Yard Disposal & Write-Off', icon: Trash2 },
                      { id: 'Accept on Deviation', label: '6. Deviation', desc: 'Quality Concession / Use As Is', icon: CheckCircle2 },
                    ].map(act => {
                      const Icon = act.icon;
                      const isSel = actionType === act.id;
                      return (
                        <div
                          key={act.id}
                          onClick={() => setActionType(act.id as any)}
                          className={`p-2.5 rounded-lg border transition-all cursor-pointer flex flex-col justify-between ${
                            isSel
                              ? 'border-blue-600 bg-blue-50/60 shadow-2xs font-semibold'
                              : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 text-slate-900 font-bold">
                            <Icon size={14} className={isSel ? 'text-blue-600' : 'text-slate-400'} />
                            <span className="text-xs">{act.label}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 mt-1">{act.desc}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Return to Vendor Subform */}
                {actionType === 'Return to Vendor' && (
                  <div className="p-3 bg-rose-50/40 rounded-lg border border-rose-200 space-y-2">
                    <h4 className="font-bold text-rose-900 text-xs">Tax Return Bill & Debit Note Parameters</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Vehicle / Carrier #</label>
                        <input
                          type="text"
                          placeholder="e.g. MH-12-AB-1234"
                          value={rtvPayload.vehicleNumber}
                          onChange={e => setRtvPayload({ ...rtvPayload, vehicleNumber: e.target.value })}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">GST Tax Rate (%)</label>
                        <select
                          value={rtvPayload.taxRate}
                          onChange={e => setRtvPayload({ ...rtvPayload, taxRate: Number(e.target.value) })}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-mono text-slate-800"
                        >
                          <option value={18}>18% GST (Standard)</option>
                          <option value={12}>12% GST</option>
                          <option value={5}>5% GST</option>
                          <option value={28}>28% GST</option>
                          <option value={0}>0% (Exempt)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Debit Note Ref #</label>
                        <input
                          type="text"
                          value={rtvPayload.debitNoteNumber}
                          onChange={e => setRtvPayload({ ...rtvPayload, debitNoteNumber: e.target.value })}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-mono text-slate-800"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Scrap Bin Subform */}
                {actionType === 'Scrap & Write-Off' && (
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                    <h4 className="font-bold text-slate-800 text-xs">Scrap Bin Allocation & Salvage Rate</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Scrap Bin Location / Bay</label>
                        <input
                          type="text"
                          value={scrapPayload.scrapLocation}
                          onChange={e => setScrapPayload({ ...scrapPayload, scrapLocation: e.target.value })}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Expected Salvage Rate (₹/KG)</label>
                        <input
                          type="number"
                          value={scrapPayload.salvageRatePerKg}
                          onChange={e => setScrapPayload({ ...scrapPayload, salvageRatePerKg: Number(e.target.value) })}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-mono text-slate-800"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Rework Subform */}
                {(actionType === 'Internal Rework' || actionType === 'External Rework') && (
                  <div className="p-3 bg-blue-50/40 rounded-lg border border-blue-200 space-y-2">
                    <h4 className="font-bold text-blue-900 text-xs">Rework Routing & Instructions</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Assigned Station / Operator</label>
                        <input
                          type="text"
                          value={reworkPayload.assignedWorkstation}
                          onChange={e => setReworkPayload({ ...reworkPayload, assignedWorkstation: e.target.value })}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Rework Instructions</label>
                        <input
                          type="text"
                          value={reworkPayload.reworkInstructions}
                          onChange={e => setReworkPayload({ ...reworkPayload, reworkInstructions: e.target.value })}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-800"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Deviation Subform */}
                {actionType === 'Accept on Deviation' && (
                  <div className="p-3 bg-emerald-50/40 rounded-lg border border-emerald-200 space-y-2">
                    <h4 className="font-bold text-emerald-900 text-xs">Quality Concession Approval</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Deviation Ref #</label>
                        <input
                          type="text"
                          value={concessionPayload.deviationRefNumber}
                          onChange={e => setConcessionPayload({ ...concessionPayload, deviationRefNumber: e.target.value })}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-mono text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Concession Reason</label>
                        <input
                          type="text"
                          value={concessionPayload.concessionReason}
                          onChange={e => setConcessionPayload({ ...concessionPayload, concessionReason: e.target.value })}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-800"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Action Notes & Auditor Remarks:
                  </label>
                  <textarea
                    rows={2}
                    value={actionNotes}
                    onChange={e => setActionNotes(e.target.value)}
                    placeholder="Enter root cause notes or operational instructions..."
                    className="w-full p-2 border border-slate-200 rounded-lg bg-white outline-none text-xs text-slate-800"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedTicket(null)}
                    className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-slate-700 font-semibold cursor-pointer hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAction}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-2xs cursor-pointer disabled:opacity-50"
                  >
                    {submittingAction ? 'Executing...' : 'Execute Disposition'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. 24-Hour Edit Action Modal */}
      <AnimatePresence>
        {editTicket && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white w-full max-w-xl rounded-xl shadow-xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col"
            >
              <div className="p-3.5 sm:p-4 bg-amber-50 border-b border-amber-200 text-amber-900 flex justify-between items-center shrink-0">
                <div>
                  <span className="text-[10px] font-mono uppercase bg-amber-200/70 text-amber-900 px-2 py-0.5 rounded font-bold">
                    24-Hour Edit Window
                  </span>
                  <h3 className="text-sm sm:text-base font-bold mt-0.5 text-slate-900">
                    Edit Action: {editTicket.materialName} ({editTicket.documentNumber || editTicket.ticketNumber})
                  </h3>
                  {(editTicket.partNumber || editTicket.partNo || editTicket.materialCode || editTicket.itemCode) && (
                    <div className="text-[11px] font-mono font-bold text-indigo-700 mt-0.5 flex items-center gap-1">
                      <span className="text-[9px] font-sans text-slate-500 uppercase font-semibold">Part No:</span>
                      <span>{editTicket.partNumber || editTicket.partNo || editTicket.materialCode || editTicket.itemCode}</span>
                    </div>
                  )}
                </div>
                <button onClick={() => setEditTicket(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <XCircle size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmitEditAction} className="p-3.5 sm:p-4 space-y-3.5 text-xs overflow-y-auto flex-1">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Corrective Action Pathway:
                  </label>
                  <select
                    value={actionType}
                    onChange={e => setActionType(e.target.value as any)}
                    className="w-full p-2 border border-slate-200 rounded-lg bg-white font-bold text-xs text-slate-800"
                  >
                    <option value="Return to Vendor">Return to Vendor (Return Bill)</option>
                    <option value="Vendor Replacement">Vendor Replacement (Replacement DC)</option>
                    <option value="External Rework">Subcontractor Rework (FOC Rework DC)</option>
                    <option value="Internal Rework">Internal Rework</option>
                    <option value="Scrap & Write-Off">Scrap & Write-Off (Scrap Bin)</option>
                    <option value="Accept on Deviation">Accept on Deviation (Concession)</option>
                  </select>
                </div>

                {actionType === 'Return to Vendor' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Vehicle #</label>
                      <input
                        type="text"
                        value={rtvPayload.vehicleNumber}
                        onChange={e => setRtvPayload({ ...rtvPayload, vehicleNumber: e.target.value })}
                        className="w-full p-2 border border-slate-200 rounded-lg bg-white text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Debit Note #</label>
                      <input
                        type="text"
                        value={rtvPayload.debitNoteNumber}
                        onChange={e => setRtvPayload({ ...rtvPayload, debitNoteNumber: e.target.value })}
                        className="w-full p-2 border border-slate-200 rounded-lg bg-white font-mono text-slate-800"
                      />
                    </div>
                  </div>
                )}

                {actionType === 'Scrap & Write-Off' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Scrap Bin Location</label>
                      <input
                        type="text"
                        value={scrapPayload.scrapLocation}
                        onChange={e => setScrapPayload({ ...scrapPayload, scrapLocation: e.target.value })}
                        className="w-full p-2 border border-slate-200 rounded-lg bg-white text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Salvage Rate (₹/KG)</label>
                      <input
                        type="number"
                        value={scrapPayload.salvageRatePerKg}
                        onChange={e => setScrapPayload({ ...scrapPayload, salvageRatePerKg: Number(e.target.value) })}
                        className="w-full p-2 border border-slate-200 rounded-lg bg-white font-mono text-slate-800"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Modification Reason:
                  </label>
                  <textarea
                    rows={2}
                    value={actionNotes}
                    onChange={e => setActionNotes(e.target.value)}
                    placeholder="Reason for modifying disposition..."
                    className="w-full p-2 border border-slate-200 rounded-lg bg-white text-xs text-slate-800"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 shrink-0">
                  <button type="button" onClick={() => setEditTicket(null)} className="px-3.5 py-1.5 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 font-semibold">
                    Cancel
                  </button>
                  <button type="submit" disabled={submittingAction} className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg cursor-pointer">
                    {submittingAction ? 'Saving...' : 'Update Action'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. Rework Re-Inspection Completion Modal */}
      <AnimatePresence>
        {reworkModalTicket && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white w-full max-w-lg rounded-xl shadow-xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col"
            >
              <div className="p-3.5 sm:p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center shrink-0">
                <h3 className="text-sm font-bold text-slate-900">
                  Log Rework Re-Inspection: {reworkModalTicket.materialName}
                </h3>
                <button onClick={() => setReworkModalTicket(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <XCircle size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmitReworkComplete} className="p-3.5 sm:p-4 space-y-3 text-xs overflow-y-auto flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Passed Quantity</label>
                    <input
                      type="number"
                      value={reworkCompleteForm.passedQuantity}
                      onChange={e => setReworkCompleteForm({ ...reworkCompleteForm, passedQuantity: Number(e.target.value) })}
                      className="w-full p-2 border border-slate-200 rounded-lg bg-white font-mono font-bold text-emerald-700"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Scrapped Portion (Scrap Bin)</label>
                    <input
                      type="number"
                      value={reworkCompleteForm.scrappedQuantity}
                      onChange={e => setReworkCompleteForm({ ...reworkCompleteForm, scrappedQuantity: Number(e.target.value) })}
                      className="w-full p-2 border border-slate-200 rounded-lg bg-white font-mono font-bold text-rose-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Rework Hours Spent</label>
                    <input
                      type="number"
                      value={reworkCompleteForm.hoursSpent}
                      onChange={e => setReworkCompleteForm({ ...reworkCompleteForm, hoursSpent: Number(e.target.value) })}
                      className="w-full p-2 border border-slate-200 rounded-lg bg-white font-mono text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Consumables Cost (₹)</label>
                    <input
                      type="number"
                      value={reworkCompleteForm.consumablesCost}
                      onChange={e => setReworkCompleteForm({ ...reworkCompleteForm, consumablesCost: Number(e.target.value) })}
                      className="w-full p-2 border border-slate-200 rounded-lg bg-white font-mono text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">QC Re-Inspection Remarks</label>
                  <input
                    type="text"
                    value={reworkCompleteForm.remarks}
                    onChange={e => setReworkCompleteForm({ ...reworkCompleteForm, remarks: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-lg bg-white text-slate-800"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 shrink-0">
                  <button type="button" onClick={() => setReworkModalTicket(null)} className="px-3.5 py-1.5 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 font-semibold">
                    Cancel
                  </button>
                  <button type="submit" disabled={submittingAction} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer">
                    {submittingAction ? 'Saving...' : 'Confirm Clearance'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

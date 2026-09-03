"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  AlertTriangle, RotateCcw, Truck, Trash2, CheckCircle2, 
  Search, Filter, Clock, ArrowRight, ShieldAlert, 
  FileText, User, Calendar, Plus, RefreshCw, ChevronRight,
  TrendingDown, DollarSign, Wrench, CheckCheck, XCircle, AlertCircle,
  ClipboardCheck, Activity, Settings, CheckSquare, Layers, Lock, Edit3, Download, Printer
} from 'lucide-react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  generateMRBCorrectiveActionPDF,
  generateReturnInvoicePDF,
  generateReplacementDcPDF,
  generateScrapCertificatePDF
} from '@/src/utils/frontendPdfHelper';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface RejectionReworkHubProps {
  context?: 'quality' | 'store';
}

type QCTypeFilter = 'all' | 'IncomingQC' | 'ProcessQC' | 'JobWorkQC' | 'FGQC';
type SubViewType = 'pending' | 'scrap_bin' | 'rework' | 'rtv' | 'deviation';

export default function RejectionReworkHub({ context = 'quality' }: RejectionReworkHubProps) {
  const [activeQcType, setActiveQcType] = useState<QCTypeFilter>('all');
  const [activeSubView, setActiveSubView] = useState<SubViewType>('pending');
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [defectFilter, setDefectFilter] = useState<string>('all');
  
  // Data States
  const [queue, setQueue] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    totalPendingCount: 0,
    incomingCount: 0,
    processCount: 0,
    jobWorkCount: 0,
    fgCount: 0,
    activeReworkCount: 0,
    pendingRtvCount: 0,
    totalEstimatedLoss: 0,
  });
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [scrapData, setScrapData] = useState<any>({ scrapTickets: [], summary: {} });

  // Disposition Action Modal State (New Action)
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
      
      const [pendingRes, historyRes, scrapRes] = await Promise.allSettled([
        axios.get(`${API_BASE_URL}/api/store/mrb/pending`, config),
        axios.get(`${API_BASE_URL}/api/store/mrb/history`, config),
        axios.get(`${API_BASE_URL}/api/store/mrb/scrap-ledger`, config),
      ]);

      if (pendingRes.status === 'fulfilled' && pendingRes.value.data?.data) {
        setQueue(pendingRes.value.data.data.queue || []);
        setStats(pendingRes.value.data.data.stats || {});
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
  }, []);

  // Helper: check if ticket is within 24 hours of disposition
  const get24HourEditInfo = (ticket: any) => {
    if (!ticket.dispositionDate) return { isEditable: false, remainingHours: 0 };
    const elapsedMs = Date.now() - new Date(ticket.dispositionDate).getTime();
    const elapsedHours = elapsedMs / (1000 * 60 * 60);
    const isEditable = elapsedHours <= 24 && !ticket.isLocked;
    const remainingHours = Math.max(0, 24 - elapsedHours);
    return { isEditable, remainingHours };
  };

  // Filtered List based on Active QC Type & SubView
  const currentList = useMemo(() => {
    let baseList: any[] = [];
    if (activeSubView === 'pending') {
      baseList = queue.filter(t => t.status === 'Pending Disposition');
    } else if (activeSubView === 'scrap_bin') {
      baseList = scrapData.scrapTickets || [];
    } else if (activeSubView === 'rework') {
      baseList = historyList.filter(t => t.dispositionAction?.includes('Rework'));
    } else if (activeSubView === 'rtv') {
      baseList = historyList.filter(t => t.dispositionAction === 'Return to Vendor' || t.dispositionAction === 'Vendor Replacement');
    } else if (activeSubView === 'deviation') {
      baseList = historyList.filter(t => t.dispositionAction === 'Accept on Deviation');
    }

    // Apply QC Source Type Filter
    if (activeQcType !== 'all') {
      baseList = baseList.filter(item => item.sourceType === activeQcType);
    }

    return baseList.filter(item => {
      const matName = String(item.materialName || '').toLowerCase();
      const code = String(item.materialCode || '').toLowerCase();
      const tick = String(item.ticketNumber || '').toLowerCase();
      const docNum = String(item.documentNumber || item.sourceDocNumber || '').toLowerCase();
      const matchesSearch = matName.includes(searchTerm.toLowerCase()) || code.includes(searchTerm.toLowerCase()) || tick.includes(searchTerm.toLowerCase()) || docNum.includes(searchTerm.toLowerCase());
      const matchesDefect = defectFilter === 'all' || item.defectCategory === defectFilter;
      return matchesSearch && matchesDefect;
    });
  }, [activeQcType, activeSubView, queue, historyList, scrapData, searchTerm, defectFilter]);

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
      await axios.post(`${API_BASE_URL}/api/store/mrb/rework-complete`, {
        ticketId: reworkModalTicket._id,
        ...reworkCompleteForm,
      }, config);
      setReworkModalTicket(null);
      await fetchHubData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to complete rework inspection');
    } finally {
      setSubmittingAction(false);
    }
  };

  const getSourceTypeBadge = (sourceType: string) => {
    switch (sourceType) {
      case 'IncomingQC':
        return { label: 'Incoming QC', bg: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800', icon: ClipboardCheck };
      case 'ProcessQC':
        return { label: 'Process QC', bg: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-200 dark:border-purple-800', icon: Activity };
      case 'JobWorkQC':
        return { label: 'Job Work QC', bg: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800', icon: Wrench };
      case 'FGQC':
        return { label: 'FG & PDI QC', bg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800', icon: CheckSquare };
      default:
        return { label: 'QC Inspection', bg: 'bg-slate-100 text-slate-800 border-slate-200', icon: ShieldAlert };
    }
  };

  return (
    <div className="space-y-4 font-sans">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30">
            <ShieldAlert size={20} />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
              MRB Rejection & Rework Hub
            </h2>
            <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
              <span>Material Review Board</span>
              <span>•</span>
              <span>Quality Control & Defect Governance</span>
            </div>
          </div>
        </div>

        <button
          onClick={fetchHubData}
          disabled={loading}
          className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all shrink-0"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Primary QC Source Switcher Tabs */}
      <div className="bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
          {[
            { id: 'all', label: 'All QC Sources', icon: Layers, count: queue.filter(t => t.status === 'Pending Disposition').length },
            { id: 'IncomingQC', label: 'Incoming QC', icon: ClipboardCheck, count: stats.incomingCount || 0 },
            { id: 'ProcessQC', label: 'Process QC', icon: Activity, count: stats.processCount || 0 },
            { id: 'JobWorkQC', label: 'Job Work QC', icon: Wrench, count: stats.jobWorkCount || 0 },
            { id: 'FGQC', label: 'FG & PDI QC', icon: CheckSquare, count: stats.fgCount || 0 },
          ].map(tab => {
            const Icon = tab.icon;
            const isSel = activeQcType === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveQcType(tab.id as any)}
                className={`px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                  isSel
                    ? 'bg-indigo-50/80 border-indigo-600 text-indigo-900 dark:bg-indigo-950/70 dark:border-indigo-500 dark:text-indigo-200 shadow-xs'
                    : 'bg-slate-50/50 border-slate-200 hover:bg-slate-100 text-slate-700 dark:bg-slate-800/40 dark:border-slate-800 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs">
                  <Icon size={14} className={isSel ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'} />
                  <span>{tab.label}</span>
                </div>
                {tab.count > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold ${
                    isSel ? 'bg-indigo-600 text-white' : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sub-view Switcher with Clean Tab Names */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-white dark:bg-slate-900 p-2 sm:p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex overflow-x-auto gap-1.5 no-scrollbar">
          {[
            { id: 'pending', label: 'Pending Queue', count: queue.filter(t => t.status === 'Pending Disposition').length },
            { id: 'scrap_bin', label: 'Scrap Bin', count: scrapData.scrapTickets?.length || 0, badgeColor: 'bg-rose-500 text-white' },
            { id: 'rework', label: 'Active Rework', count: historyList.filter(t => t.dispositionAction?.includes('Rework') && t.status === 'In Progress').length },
            { id: 'rtv', label: 'Returns & DCs' },
            { id: 'deviation', label: 'Concessions' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubView(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeSubView === tab.id
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-extrabold ${
                  tab.badgeColor || (activeSubView === tab.id ? 'bg-amber-400 text-slate-900' : 'bg-amber-100 text-amber-800')
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search material, code, doc #..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
            />
          </div>

          <select
            value={defectFilter}
            onChange={(e) => setDefectFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-medium outline-none cursor-pointer"
          >
            <option value="all">All Defects</option>
            <option value="Dimensional Deviation">Dimensional</option>
            <option value="Visual / Surface Defect">Visual / Surface</option>
            <option value="Material Chemical / Hardness Failure">Chemical / Hardness</option>
            <option value="Machining Defect / Burr">Machining / Burr</option>
            <option value="Subcontractor Flaw">Subcontractor</option>
          </select>
        </div>
      </div>


      {/* Main Table Content */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="animate-spin mx-auto mb-2 opacity-50" size={24} />
            <p className="text-xs font-semibold">Loading Quality Rejection & MRB records...</p>
          </div>
        ) : currentList.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <CheckCircle2 className="mx-auto text-emerald-500 opacity-60" size={32} />
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
              No active records in this view
            </h4>
            <p className="text-xs text-slate-400">All defective material workflows are current and up to date.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3.5">QC Phase / Doc #</th>
                  <th className="p-3.5">Material & Description</th>
                  <th className="p-3.5 text-center">Defect Quantity</th>
                  <th className="p-3.5">Defect Reason & Root Cause</th>
                  <th className="p-3.5">Origin / Supplier / Station</th>
                  <th className="p-3.5">Action & Governance</th>
                  <th className="p-3.5 text-right">Documents & Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {currentList.map((item, idx) => {
                  const qty = Number(item.rejectedQuantity || item.reworkDetails?.reworkScrappedQuantity || 0);
                  const badge = getSourceTypeBadge(item.sourceType);
                  const BadgeIcon = badge.icon;
                  const { isEditable, remainingHours } = get24HourEditInfo(item);

                  return (
                    <tr key={item._id || idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5">
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wide border flex items-center gap-1.5 w-fit ${badge.bg}`}>
                          <BadgeIcon size={12} />
                          {badge.label}
                        </span>
                        <span className="font-mono text-[10.5px] font-extrabold text-indigo-600 dark:text-indigo-400 block mt-1">
                          {item.documentNumber || item.sourceDocNumber || item.ticketNumber}
                        </span>
                      </td>

                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 dark:text-white text-xs">{item.materialName}</div>
                        <div className="text-[10.5px] text-slate-400 flex items-center gap-1.5 mt-0.5 font-mono">
                          {item.materialCode && <span>{item.materialCode}</span>}
                          <span>• {item.itemType}</span>
                        </div>
                      </td>

                      <td className="p-3.5 text-center">
                        <span className="px-2.5 py-1 bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-mono font-black text-xs rounded-lg border border-rose-200 dark:border-rose-800 block w-fit mx-auto">
                          {qty} {item.unit || 'KG'}
                        </span>
                        {item.unitRate > 0 && (
                          <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                            ₹{(qty * item.unitRate).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 max-w-[220px]">
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded font-bold text-[10px] block w-fit mb-1">
                          {item.defectCategory || 'Defect'}
                        </span>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate" title={item.rejectionReason}>
                          {item.rejectionReason || 'Inspection failure'}
                        </p>
                      </td>

                      <td className="p-3.5">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                          {item.vendorName || item.workstation || 'Shop Floor'}
                        </div>
                        {item.scrapDetails?.scrapLocation && (
                          <span className="text-[10px] font-mono text-rose-500 block">Bay: {item.scrapDetails.scrapLocation}</span>
                        )}
                        <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                          {new Date(item.createdAt || Date.now()).toLocaleDateString('en-GB')}
                        </span>
                      </td>

                      <td className="p-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide block w-fit ${
                          item.status === 'Completed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                          item.status === 'In Progress' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300' :
                          'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}>
                          {item.dispositionAction !== 'Pending' ? item.dispositionAction : item.status}
                        </span>

                        {/* 24-Hour Edit Governance Badge */}
                        {item.dispositionDate && (
                          <div className="mt-1">
                            {isEditable ? (
                              <span className="text-[9.5px] font-mono text-amber-600 dark:text-amber-400 flex items-center gap-1 font-bold">
                                <Clock size={10} /> {remainingHours.toFixed(1)}h left to edit
                              </span>
                            ) : (
                              <span className="text-[9.5px] font-mono text-slate-400 flex items-center gap-1">
                                <Lock size={10} /> Audit Locked
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="p-3.5 text-right space-y-1">
                        {/* Primary Actions */}
                        {item.status === 'Pending Disposition' ? (
                          <button
                            onClick={() => handleOpenActionModal(item)}
                            className="px-3 py-1.5 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 text-white font-bold rounded-xl shadow-xs transition-all cursor-pointer text-[11px] flex items-center gap-1 ml-auto"
                          >
                            <span>Take Action</span>
                            <ArrowRight size={12} />
                          </button>
                        ) : item.dispositionAction?.includes('Rework') && item.status === 'In Progress' ? (
                          <button
                            onClick={() => handleOpenReworkComplete(item)}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition-all cursor-pointer text-[11px] flex items-center gap-1 ml-auto"
                          >
                            <CheckCheck size={12} />
                            <span>Complete QC</span>
                          </button>
                        ) : null}

                        {/* PDF & Edit Buttons */}
                        <div className="flex items-center justify-end gap-1 flex-wrap pt-0.5">
                          {/* 24-Hour Edit Button */}
                          {isEditable && (
                            <button
                              onClick={() => handleOpenEditModal(item)}
                              className="px-2 py-1 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer hover:bg-amber-100"
                              title="Edit action within 24-hour compliance window"
                            >
                              <Edit3 size={11} />
                              <span>Edit (24h)</span>
                            </button>
                          )}

                          {/* Specific Document PDF Downloads */}
                          {item.dispositionAction === 'Return to Vendor' && (
                            <button
                              onClick={() => generateReturnInvoicePDF(item)}
                              className="px-2 py-1 bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer hover:bg-rose-100"
                              title="Download Tax Return Invoice & Debit Note"
                            >
                              <Download size={11} />
                              <span>Return Bill PDF</span>
                            </button>
                          )}

                          {item.dispositionAction === 'Vendor Replacement' && (
                            <button
                              onClick={() => generateReplacementDcPDF(item)}
                              className="px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer hover:bg-blue-100"
                              title="Download Warranty Replacement Delivery Challan"
                            >
                              <Download size={11} />
                              <span>Replacement DC</span>
                            </button>
                          )}

                          {(item.dispositionAction === 'Scrap & Write-Off' || item.reworkDetails?.reworkScrappedQuantity > 0) && (
                            <button
                              onClick={() => generateScrapCertificatePDF(item)}
                              className="px-2 py-1 bg-slate-100 text-slate-800 border border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer hover:bg-slate-200"
                              title="Download Scrap Write-Off Certificate"
                            >
                              <Download size={11} />
                              <span>Scrap Cert</span>
                            </button>
                          )}

                          {/* Master MRB Action Sheet PDF */}
                          {item.dispositionAction && item.dispositionAction !== 'Pending' && (
                            <button
                              onClick={() => generateMRBCorrectiveActionPDF(item)}
                              className="px-2 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer hover:bg-indigo-100"
                              title="Download MRB Corrective Action Sheet"
                            >
                              <Printer size={11} />
                              <span>MRB Report</span>
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
        )}
      </div>

      {/* 5-Action Disposition Modal */}
      <AnimatePresence>
        {selectedTicket && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto"
            >
              <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">
                    MRB Action Engine • {selectedTicket.sourceType}
                  </span>
                  <h3 className="text-base sm:text-lg font-black mt-1">
                    Disposition: {selectedTicket.materialName} ({selectedTicket.rejectedQuantity} {selectedTicket.unit})
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
                >
                  <XCircle size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmitAction} className="p-5 space-y-4 text-xs">
                {/* 5 Action Selector Cards */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                    Select Corrective Action Pathway:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { id: 'Return to Vendor', label: '1. Return Bill (RTV)', desc: 'Tax Return Bill + Debit Note', icon: Truck },
                      { id: 'Vendor Replacement', label: '2. Replacement DC', desc: 'Warranty Delivery Challan', icon: RotateCcw },
                      { id: 'Internal Rework', label: '3. Internal Rework', desc: 'Shop Floor Reconditioning', icon: Wrench },
                      { id: 'External Rework', label: '4. External Rework', desc: 'Job Worker Reconditioning', icon: Wrench },
                      { id: 'Scrap & Write-Off', label: '5. Scrap Bin', desc: 'Scrap Yard Disposal', icon: Trash2 },
                      { id: 'Accept on Deviation', label: '6. Deviation', desc: 'Concession / Use As Is', icon: CheckCircle2 },
                    ].map(act => {
                      const Icon = act.icon;
                      const isSel = actionType === act.id;
                      return (
                        <div
                          key={act.id}
                          onClick={() => setActionType(act.id as any)}
                          className={`p-2.5 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                            isSel
                              ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/60 dark:border-indigo-500'
                              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 bg-slate-50/50 dark:bg-slate-800/40'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                            <Icon size={14} className={isSel ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'} />
                            <span>{act.label}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 mt-1">{act.desc}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Return to Vendor Subform */}
                {actionType === 'Return to Vendor' && (
                  <div className="p-3 bg-rose-50/60 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900 space-y-2">
                    <h4 className="font-bold text-rose-900 dark:text-rose-200 text-xs">Tax Return Bill & Debit Note Parameters (Auto RET-INV Assigned)</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Vehicle / Carrier #</label>
                        <input
                          type="text"
                          placeholder="e.g. MH-12-AB-1234"
                          value={rtvPayload.vehicleNumber}
                          onChange={e => setRtvPayload({ ...rtvPayload, vehicleNumber: e.target.value })}
                          className="w-full px-2.5 py-1.5 border rounded-lg bg-white dark:bg-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">GST Tax Rate (%)</label>
                        <select
                          value={rtvPayload.taxRate}
                          onChange={e => setRtvPayload({ ...rtvPayload, taxRate: Number(e.target.value) })}
                          className="w-full px-2.5 py-1.5 border rounded-lg bg-white dark:bg-slate-900 font-mono"
                        >
                          <option value={18}>18% GST (Standard)</option>
                          <option value={12}>12% GST</option>
                          <option value={5}>5% GST</option>
                          <option value={28}>28% GST</option>
                          <option value={0}>0% (Exempt)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Debit Note Ref #</label>
                        <input
                          type="text"
                          value={rtvPayload.debitNoteNumber}
                          onChange={e => setRtvPayload({ ...rtvPayload, debitNoteNumber: e.target.value })}
                          className="w-full px-2.5 py-1.5 border rounded-lg bg-white dark:bg-slate-900 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Scrap Bin Subform */}
                {actionType === 'Scrap & Write-Off' && (
                  <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 space-y-2">
                    <h4 className="font-bold text-slate-800 dark:text-white text-xs">Scrap Bin Allocation & Salvage Rate</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Scrap Bin Location / Bay</label>
                        <input
                          type="text"
                          value={scrapPayload.scrapLocation}
                          onChange={e => setScrapPayload({ ...scrapPayload, scrapLocation: e.target.value })}
                          className="w-full px-2.5 py-1.5 border rounded-lg bg-white dark:bg-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Expected Salvage Rate (₹/KG)</label>
                        <input
                          type="number"
                          value={scrapPayload.salvageRatePerKg}
                          onChange={e => setScrapPayload({ ...scrapPayload, salvageRatePerKg: Number(e.target.value) })}
                          className="w-full px-2.5 py-1.5 border rounded-lg bg-white dark:bg-slate-900 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Rework Subform */}
                {(actionType === 'Internal Rework' || actionType === 'External Rework') && (
                  <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-900 space-y-2">
                    <h4 className="font-bold text-indigo-900 dark:text-indigo-200 text-xs">Rework Routing & Instructions</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Assigned Station / Operator</label>
                        <input
                          type="text"
                          value={reworkPayload.assignedWorkstation}
                          onChange={e => setReworkPayload({ ...reworkPayload, assignedWorkstation: e.target.value })}
                          className="w-full px-2.5 py-1.5 border rounded-lg bg-white dark:bg-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Rework Instructions</label>
                        <input
                          type="text"
                          value={reworkPayload.reworkInstructions}
                          onChange={e => setReworkPayload({ ...reworkPayload, reworkInstructions: e.target.value })}
                          className="w-full px-2.5 py-1.5 border rounded-lg bg-white dark:bg-slate-900"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Deviation Subform */}
                {actionType === 'Accept on Deviation' && (
                  <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-900 space-y-2">
                    <h4 className="font-bold text-emerald-900 dark:text-emerald-200 text-xs">Quality Concession Approval</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Deviation Ref #</label>
                        <input
                          type="text"
                          value={concessionPayload.deviationRefNumber}
                          onChange={e => setConcessionPayload({ ...concessionPayload, deviationRefNumber: e.target.value })}
                          className="w-full px-2.5 py-1.5 border rounded-lg bg-white dark:bg-slate-900 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Concession Justification</label>
                        <input
                          type="text"
                          value={concessionPayload.concessionReason}
                          onChange={e => setConcessionPayload({ ...concessionPayload, concessionReason: e.target.value })}
                          className="w-full px-2.5 py-1.5 border rounded-lg bg-white dark:bg-slate-900"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Disposition Notes & Auditor Remarks:
                  </label>
                  <textarea
                    rows={2}
                    value={actionNotes}
                    onChange={e => setActionNotes(e.target.value)}
                    placeholder="Enter root cause notes or operational instructions..."
                    className="w-full p-2.5 border rounded-xl bg-white dark:bg-slate-900 outline-none text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setSelectedTicket(null)}
                    className="px-4 py-2 border rounded-xl text-slate-600 dark:text-slate-300 font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAction}
                    className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-extrabold rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {submittingAction ? 'Executing...' : 'Execute Disposition'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 24-Hour Edit Action Modal */}
      <AnimatePresence>
        {editTicket && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto"
            >
              <div className="p-4 bg-amber-600 text-white flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-mono uppercase bg-amber-800/60 px-2 py-0.5 rounded font-bold">
                    24-Hour Edit Governance Window
                  </span>
                  <h3 className="text-base font-black mt-0.5">
                    Edit Action: {editTicket.materialName} ({editTicket.documentNumber || editTicket.ticketNumber})
                  </h3>
                </div>
                <button onClick={() => setEditTicket(null)} className="text-amber-100 hover:text-white cursor-pointer">
                  <XCircle size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmitEditAction} className="p-5 space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Corrective Action Pathway:
                  </label>
                  <select
                    value={actionType}
                    onChange={e => setActionType(e.target.value as any)}
                    className="w-full p-2 border rounded-xl bg-white dark:bg-slate-900 font-bold text-xs"
                  >
                    <option value="Return to Vendor">Return to Vendor (Return Bill)</option>
                    <option value="Vendor Replacement">Vendor Replacement (Replacement DC)</option>
                    <option value="Internal Rework">Internal Rework</option>
                    <option value="External Rework">External Rework</option>
                    <option value="Scrap & Write-Off">Scrap & Write-Off (Scrap Bin)</option>
                    <option value="Accept on Deviation">Accept on Deviation (Concession)</option>
                  </select>
                </div>

                {actionType === 'Return to Vendor' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Vehicle #</label>
                      <input
                        type="text"
                        value={rtvPayload.vehicleNumber}
                        onChange={e => setRtvPayload({ ...rtvPayload, vehicleNumber: e.target.value })}
                        className="w-full p-2 border rounded-lg bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Debit Note #</label>
                      <input
                        type="text"
                        value={rtvPayload.debitNoteNumber}
                        onChange={e => setRtvPayload({ ...rtvPayload, debitNoteNumber: e.target.value })}
                        className="w-full p-2 border rounded-lg bg-white dark:bg-slate-900 font-mono"
                      />
                    </div>
                  </div>
                )}

                {actionType === 'Scrap & Write-Off' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Scrap Bin Location</label>
                      <input
                        type="text"
                        value={scrapPayload.scrapLocation}
                        onChange={e => setScrapPayload({ ...scrapPayload, scrapLocation: e.target.value })}
                        className="w-full p-2 border rounded-lg bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Salvage Rate (₹/KG)</label>
                      <input
                        type="number"
                        value={scrapPayload.salvageRatePerKg}
                        onChange={e => setScrapPayload({ ...scrapPayload, salvageRatePerKg: Number(e.target.value) })}
                        className="w-full p-2 border rounded-lg bg-white dark:bg-slate-900 font-mono"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Updated Action Justification:
                  </label>
                  <textarea
                    rows={2}
                    value={actionNotes}
                    onChange={e => setActionNotes(e.target.value)}
                    placeholder="Reason for modifying disposition within 24h window..."
                    className="w-full p-2 border rounded-xl bg-white dark:bg-slate-900 text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button type="button" onClick={() => setEditTicket(null)} className="px-4 py-2 border rounded-xl cursor-pointer">
                    Cancel
                  </button>
                  <button type="submit" disabled={submittingAction} className="px-5 py-2 bg-amber-600 text-white font-bold rounded-xl cursor-pointer">
                    {submittingAction ? 'Saving...' : 'Update Action'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Rework Re-Inspection Completion Modal */}
      <AnimatePresence>
        {reworkModalTicket && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto"
            >
              <div className="p-4 bg-indigo-900 text-white flex justify-between items-center">
                <h3 className="text-sm font-black">
                  Log Rework Re-Inspection: {reworkModalTicket.materialName}
                </h3>
                <button onClick={() => setReworkModalTicket(null)} className="text-slate-300 hover:text-white cursor-pointer">
                  <XCircle size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmitReworkComplete} className="p-4 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Passed Quantity</label>
                    <input
                      type="number"
                      value={reworkCompleteForm.passedQuantity}
                      onChange={e => setReworkCompleteForm({ ...reworkCompleteForm, passedQuantity: Number(e.target.value) })}
                      className="w-full p-2 border rounded-lg bg-white dark:bg-slate-900 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Scrapped Portion (Moves to Scrap Bin)</label>
                    <input
                      type="number"
                      value={reworkCompleteForm.scrappedQuantity}
                      onChange={e => setReworkCompleteForm({ ...reworkCompleteForm, scrappedQuantity: Number(e.target.value) })}
                      className="w-full p-2 border rounded-lg bg-white dark:bg-slate-900 font-mono font-bold text-rose-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Rework Hours Spent</label>
                    <input
                      type="number"
                      value={reworkCompleteForm.hoursSpent}
                      onChange={e => setReworkCompleteForm({ ...reworkCompleteForm, hoursSpent: Number(e.target.value) })}
                      className="w-full p-2 border rounded-lg bg-white dark:bg-slate-900 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Consumables Cost (₹)</label>
                    <input
                      type="number"
                      value={reworkCompleteForm.consumablesCost}
                      onChange={e => setReworkCompleteForm({ ...reworkCompleteForm, consumablesCost: Number(e.target.value) })}
                      className="w-full p-2 border rounded-lg bg-white dark:bg-slate-900 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">QC Re-Inspection Remarks</label>
                  <input
                    type="text"
                    value={reworkCompleteForm.remarks}
                    onChange={e => setReworkCompleteForm({ ...reworkCompleteForm, remarks: e.target.value })}
                    className="w-full p-2 border rounded-lg bg-white dark:bg-slate-900"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button type="button" onClick={() => setReworkModalTicket(null)} className="px-4 py-1.5 border rounded-xl cursor-pointer">
                    Cancel
                  </button>
                  <button type="submit" disabled={submittingAction} className="px-4 py-1.5 bg-indigo-600 text-white font-bold rounded-xl cursor-pointer">
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

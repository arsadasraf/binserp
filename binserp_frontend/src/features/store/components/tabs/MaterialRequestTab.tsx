"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Package, 
  Layers, 
  ShoppingCart, 
  Boxes, 
  FileText, 
  RefreshCw, 
  User, 
  Table, 
  Calendar,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  Building2
} from 'lucide-react';
import { motion } from 'framer-motion';
import Swal from 'sweetalert2';
import { apiGet, apiPost } from '@/src/lib/api';
import { usePermission } from '@/src/hooks/usePermission';
import MaterialRequestModal, { RequestInventoryType } from '../modals/MaterialRequestModal';
import MaterialRequestDetailsModal from '../modals/MaterialRequestDetailsModal';
import MaterialRequestLedgerTable from '../tables/MaterialRequestLedgerTable';

interface MaterialRequestTabProps {
  token?: string | null;
  initialType?: string;
  onError?: (msg: string) => void;
  onSuccess?: (msg: string) => void;
}

export default function MaterialRequestTab({
  token: propToken,
  initialType = 'all',
  onError,
  onSuccess
}: MaterialRequestTabProps) {
  const token = propToken || (typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '');
  const { user, userType } = usePermission();

  const [loading, setLoading] = useState(true);
  const [materialRequests, setMaterialRequests] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<string>(initialType || 'all');
  const [adminScope, setAdminScope] = useState<'all' | 'mine'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState('');

  // Masters for request modal
  const [rawMaterials, setRawMaterials] = useState<any[]>([]);
  const [boughtOuts, setBoughtOuts] = useState<any[]>([]);
  const [consumables, setConsumables] = useState<any[]>([]);
  const [fgItems, setFgItems] = useState<any[]>([]);
  const [customerPos, setCustomerPos] = useState<any[]>([]);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRequestForDetails, setSelectedRequestForDetails] = useState<any | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Compute allowed request types and store management privileges based on User Role Policies
  const { allowedRequestTypes, isAdminOrStore } = useMemo(() => {
    const isCompanyOrAdmin = userType === 'company' || userType === 'saasadmin';
    const roleName = user?.role?.name || '';
    const isGM = roleName === 'GM' || roleName === 'Admin Default Role' || roleName === 'Company Management';

    if (isCompanyOrAdmin || isGM) {
      return {
        allowedRequestTypes: ['consumable', 'rm', 'bo', 'fg'] as RequestInventoryType[],
        isAdminOrStore: true,
      };
    }

    const types: RequestInventoryType[] = [];
    let canApprove = false;

    const policies = user?.role?.policies || [];
    for (const p of policies) {
      const mod = (p.module || '').toLowerCase();
      if (mod === 'materialrequests' || mod === 'material-requests' || mod === 'store') {
        for (const t of (p.tabs || [])) {
          const tabStr = (typeof t === 'string' ? t : (t as any).name || '').toLowerCase();
          if (tabStr.includes('rm')) types.push('rm');
          if (tabStr.includes('bo')) types.push('bo');
          if (tabStr.includes('consumable')) types.push('consumable');
          if (tabStr.includes('fg')) types.push('fg');
          if (tabStr.includes('approve') || tabStr.includes('issue') || tabStr.includes('store')) canApprove = true;
        }
      }
    }

    const finalTypes: RequestInventoryType[] = types.length > 0 
      ? Array.from(new Set(types)) 
      : ['consumable', 'rm', 'bo', 'fg'];

    return {
      allowedRequestTypes: finalTypes,
      isAdminOrStore: canApprove,
    };
  }, [user, userType]);

  // If user only has access to a single type, default active tab to that type
  useEffect(() => {
    if (allowedRequestTypes.length === 1 && (activeTab === 'all' || activeTab === '')) {
      setActiveTab(allowedRequestTypes[0]);
    }
  }, [allowedRequestTypes]);

  // Load master data and requests
  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [reqRes, rmRes, boRes, consRes, fgRes, poRes] = await Promise.allSettled([
        apiGet('/api/store/material-request', token),
        apiGet('/api/store/raw-material', token),
        apiGet('/api/store/bought-out', token),
        apiGet('/api/store/consumable-item', token),
        apiGet('/api/store/fg-item', token),
        apiGet('/api/sales/incoming-po', token)
      ]);

      if (reqRes.status === 'fulfilled' && reqRes.value) {
        setMaterialRequests(reqRes.value.materialRequests || reqRes.value.data || []);
      }
      if (rmRes.status === 'fulfilled' && rmRes.value) {
        setRawMaterials(Array.isArray(rmRes.value) ? rmRes.value : (rmRes.value.rawMaterials || rmRes.value.data || []));
      }
      if (boRes.status === 'fulfilled' && boRes.value) {
        setBoughtOuts(Array.isArray(boRes.value) ? boRes.value : (boRes.value.boughtOuts || boRes.value.data || []));
      }
      if (consRes.status === 'fulfilled' && consRes.value) {
        setConsumables(Array.isArray(consRes.value) ? consRes.value : (consRes.value.consumableItems || consRes.value.data || []));
      }
      if (fgRes.status === 'fulfilled' && fgRes.value) {
        setFgItems(Array.isArray(fgRes.value) ? fgRes.value : (fgRes.value.fgItems || fgRes.value.data || []));
      }
      if (poRes.status === 'fulfilled' && poRes.value) {
        setCustomerPos(Array.isArray(poRes.value) ? poRes.value : (poRes.value.pos || poRes.value.incomingPOs || []));
      }
    } catch (err: any) {
      console.error("Failed to load material request data:", err);
      if (onError) onError(err.message || "Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  // Handle Request Creation
  const handleCreateRequest = async (formData: any) => {
    try {
      const res = await apiPost('/api/store/material-request', formData, token);
      Swal.fire({
        icon: 'success',
        title: 'Request Submitted!',
        text: `Material request #${res.materialRequest?.requestNumber || formData.requestNumber} created.`,
        timer: 1800,
        showConfirmButton: false
      });
      setIsCreateModalOpen(false);
      fetchData();
      if (onSuccess) onSuccess("Material request created successfully");
    } catch (err: any) {
      console.error("Create request failed:", err);
      Swal.fire('Error', err.message || 'Failed to submit requisition', 'error');
    }
  };

  // Helper to accurately match if a request was created by / belongs to the current user
  const isRequestByUser = (r: any, currentUser: any) => {
    if (!currentUser) return false;

    // Collect all valid IDs and identifiers for the current user
    const currentIds = [
      currentUser._id,
      currentUser.id,
      currentUser.userId,
      currentUser.employeeId,
    ].filter(Boolean).map(id => String(id).trim().toLowerCase());

    const currentNames = [
      currentUser.name,
      currentUser.companyName,
      currentUser.username,
    ].filter(Boolean).map(n => String(n).trim().toLowerCase());

    const currentEmails = [
      currentUser.email,
    ].filter(Boolean).map(e => String(e).trim().toLowerCase());

    // 1. Check requestedBy object
    const reqBy = r.requestedBy;
    if (reqBy && typeof reqBy === 'object') {
      const targetIds = [reqBy._id, reqBy.id, reqBy.userId].filter(Boolean).map(id => String(id).trim().toLowerCase());
      if (targetIds.some(id => currentIds.includes(id))) return true;

      const targetEmail = reqBy.email ? String(reqBy.email).trim().toLowerCase() : '';
      if (targetEmail && currentEmails.includes(targetEmail)) return true;

      const targetName = reqBy.name ? String(reqBy.name).trim().toLowerCase() : '';
      if (targetName && currentNames.includes(targetName)) return true;
    } else if (typeof reqBy === 'string' && reqBy.trim()) {
      const normalized = reqBy.trim().toLowerCase();
      if (currentIds.includes(normalized)) return true;
    }

    // 2. Check createdBy ID field
    if (r.createdBy) {
      const createdByStr = String(r.createdBy).trim().toLowerCase();
      if (currentIds.includes(createdByStr)) return true;
    }

    // 3. Check createdByName field
    if (r.createdByName) {
      const createdByNameStr = String(r.createdByName).trim().toLowerCase();
      if (currentNames.includes(createdByNameStr)) return true;
    }

    return false;
  };

  // Filtered requests: Regular users strictly see ONLY their own requests.
  const filteredRequests = useMemo(() => {
    return materialRequests.filter((r: any) => {
      // 1. Strict User Isolation for Standard Users or when Admin explicitly views "My Requisitions"
      if (!isAdminOrStore || adminScope === 'mine') {
        if (!isRequestByUser(r, user)) {
          return false;
        }
      }

      // 2. Tab Type Filter
      if (activeTab !== 'all' && activeTab !== 'ledger') {
        const norm = (r.type || 'rm').toLowerCase();
        if (activeTab === 'rm' && norm !== 'rm' && norm !== 'raw-material') return false;
        if (activeTab === 'bo' && norm !== 'bo' && norm !== 'bought-out') return false;
        if (activeTab === 'consumable' && norm !== 'consumable') return false;
        if (activeTab === 'fg' && norm !== 'fg' && norm !== 'inhouse') return false;
      }

      // 3. Status Filter
      if (statusFilter !== 'All' && r.status !== statusFilter) {
        return false;
      }

      // 4. Search Filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const reqNum = (r.requestNumber || '').toLowerCase();
        const reqBy = (r.requestedBy?.name || r.createdByName || '').toLowerCase();
        const itemsMatch = (r.items || []).some((it: any) => 
          (it.materialName || '').toLowerCase().includes(q) ||
          (it.materialCode || '').toLowerCase().includes(q)
        );
        if (!reqNum.includes(q) && !reqBy.includes(q) && !itemsMatch) {
          return false;
        }
      }

      return true;
    });
  }, [materialRequests, activeTab, isAdminOrStore, adminScope, statusFilter, searchTerm, user]);

  // Counts for Badge Indicators
  const counts = useMemo(() => {
    const baseList = isAdminOrStore && adminScope === 'all'
      ? materialRequests
      : materialRequests.filter((r: any) => isRequestByUser(r, user));

    const total = baseList.length;
    const cons = baseList.filter(r => (r.type || '').toLowerCase() === 'consumable').length;
    const rm = baseList.filter(r => ['rm', 'raw-material'].includes((r.type || '').toLowerCase())).length;
    const bo = baseList.filter(r => ['bo', 'bought-out'].includes((r.type || '').toLowerCase())).length;
    const fg = baseList.filter(r => ['fg', 'inhouse'].includes((r.type || '').toLowerCase())).length;
    const pending = baseList.filter(r => r.status === 'Pending').length;
    const approved = baseList.filter(r => r.status === 'Approved').length;
    const issued = baseList.filter(r => r.status === 'Issued').length;
    return { total, cons, rm, bo, fg, pending, approved, issued };
  }, [materialRequests, isAdminOrStore, adminScope, user]);

  // Tab definitions for Desktop & Mobile Bottom Bar
  const navTabs = useMemo(() => {
    const list = [];
    if (allowedRequestTypes.length > 1 || isAdminOrStore) {
      list.push({ id: 'all', label: 'All', icon: FileText, count: counts.total });
    }
    if (allowedRequestTypes.includes('consumable')) {
      list.push({ id: 'consumable', label: 'Consumables', icon: Package, count: counts.cons });
    }
    if (allowedRequestTypes.includes('rm')) {
      list.push({ id: 'rm', label: 'Raw Material', icon: Layers, count: counts.rm });
    }
    if (allowedRequestTypes.includes('bo')) {
      list.push({ id: 'bo', label: 'Bought Out', icon: ShoppingCart, count: counts.bo });
    }
    if (allowedRequestTypes.includes('fg')) {
      list.push({ id: 'fg', label: 'FG', icon: Boxes, count: counts.fg });
    }
    list.push({ id: 'ledger', label: 'Ledger', icon: Table, count: null });
    return list;
  }, [allowedRequestTypes, isAdminOrStore, counts]);

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-28 md:pb-8">
      {/* 1. Desktop Top Bar: Navigation Tabs (Top Left) + Admin Scope & New Request Button (Top Right) */}
      <div className="hidden md:flex items-center justify-between gap-3">
        {/* Top Navigation Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100/90 dark:bg-slate-800/90 p-1.5 rounded-2xl shadow-inner w-fit">
          {navTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700/60"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeMaterialTabDesktop"
                    className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl"
                    initial={false}
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <div className="relative z-10 flex items-center gap-1.5">
                  <Icon size={15} />
                  <span>{tab.label}</span>
                  {tab.count !== null && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Desktop Right Controls: Admin Scope & New Request */}
        <div className="flex items-center gap-2">
          {isAdminOrStore && (
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold shadow-2xs">
              <button
                type="button"
                onClick={() => setAdminScope('all')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  adminScope === 'all'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Store Queue ({counts.total})
              </button>
              <button
                type="button"
                onClick={() => setAdminScope('mine')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  adminScope === 'mine'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                My Requisitions
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow-md cursor-pointer active:scale-95"
          >
            <Plus size={16} className="stroke-[3]" />
            <span>New Request</span>
          </button>
        </div>
      </div>

      {/* Mobile Top Controls (For Store Admins / Scope) */}
      {isAdminOrStore && (
        <div className="md:hidden flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold shadow-2xs w-full">
          <button
            type="button"
            onClick={() => setAdminScope('all')}
            className={`flex-1 py-1.5 text-center rounded-lg transition-all cursor-pointer ${
              adminScope === 'all'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Store Queue ({counts.total})
          </button>
          <button
            type="button"
            onClick={() => setAdminScope('mine')}
            className={`flex-1 py-1.5 text-center rounded-lg transition-all cursor-pointer ${
              adminScope === 'mine'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            My Requisitions
          </button>
        </div>
      )}

      {/* 2. Main Content: Ledger Table OR (Desktop List Table + Mobile Cards) */}
      {activeTab === 'ledger' ? (
        <MaterialRequestLedgerTable
          requests={materialRequests}
          onView={(req) => {
            setSelectedRequestForDetails(req);
            setIsDetailsModalOpen(true);
          }}
          loading={loading}
        />
      ) : (
        <div className="space-y-3">
          {/* Quick Search, Refresh & Status Pills */}
          <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
                <input
                  type="text"
                  placeholder="Search by Req #, item name, code..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium dark:text-white focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={fetchData}
                className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors cursor-pointer shrink-0"
                title="Refresh requests"
              >
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>

            {/* Status Pills */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
              {(['All', 'Pending', 'Approved', 'Issued', 'Rejected'] as const).map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    statusFilter === st
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Empty State */}
          {filteredRequests.length === 0 ? (
            <div className="py-16 text-center bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs">
              <Package className="mx-auto mb-2 text-slate-300 dark:text-slate-600" size={36} />
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Requisitions Found</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {!isAdminOrStore ? 'You have not raised any requests in this category.' : 'No requisitions match your criteria.'}
              </p>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
              >
                <Plus size={15} /> Raise Requisition
              </button>
            </div>
          ) : (
            <>
              {/* DESKTOP TABLE VIEW (List for Desktop) */}
              <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-4">Request # & Date</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Target SO / MRP</th>
                        <th className="py-3 px-4">Requester</th>
                        <th className="py-3 px-4">Items Summary</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredRequests.map(req => {
                        const normType = (req.type || 'rm').toLowerCase();
                        const requester = req.requestedBy?.name || req.createdByName || 'User';
                        const dept = req.department || req.requestedBy?.department || 'General';
                        const dateStr = req.createdAt ? new Date(req.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
                        const itemsCount = req.items?.length || 0;

                        return (
                          <tr
                            key={req._id}
                            onClick={() => {
                              setSelectedRequestForDetails(req);
                              setIsDetailsModalOpen(true);
                            }}
                            className="hover:bg-slate-50/90 dark:hover:bg-slate-800/60 transition-colors cursor-pointer group"
                          >
                            {/* Request # & Date */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="font-mono font-black text-blue-600 dark:text-blue-400 group-hover:underline">
                                {req.requestNumber}
                              </div>
                              <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <Calendar size={11} /> {dateStr}
                              </div>
                            </td>

                            {/* Inventory Type */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${
                                normType === 'consumable' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300' :
                                normType === 'bo' || normType === 'bought-out' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300' :
                                normType === 'fg' || normType === 'inhouse' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300' :
                                'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300'
                              }`}>
                                {normType}
                              </span>
                            </td>

                            {/* Target SO / MRP */}
                            <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px]">
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

                            {/* Requester & Department */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                <User size={13} className="text-slate-400" />
                                {requester}
                              </div>
                              {dept && (
                                <div className="text-[10px] text-slate-400 pl-4">
                                  {dept}
                                </div>
                              )}
                            </td>

                            {/* Items Summary */}
                            <td className="py-3 px-4">
                              <div className="flex flex-wrap gap-1 max-w-sm">
                                {(req.items || []).slice(0, 2).map((it: any, iIdx: number) => (
                                  <span key={iIdx} className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-medium border border-slate-200 dark:border-slate-700">
                                    {it.materialName || it.name} ({it.quantity} {it.unit || 'PCS'})
                                  </span>
                                ))}
                                {itemsCount > 2 && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-[10px] font-bold border border-blue-200 dark:border-blue-800">
                                    +{itemsCount - 2} more
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Status */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${
                                req.status === 'Issued' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' :
                                req.status === 'Approved' ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800' :
                                req.status === 'Rejected' ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800' :
                                'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800'
                              }`}>
                                {req.status}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-4 whitespace-nowrap text-right" onClick={e => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedRequestForDetails(req);
                                  setIsDetailsModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 dark:bg-slate-800 dark:hover:bg-blue-950/60 dark:text-slate-300 dark:hover:text-blue-300 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                              >
                                <span>Details</span>
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

              {/* MOBILE CARDS VIEW (Card for Mobile) */}
              <div className="md:hidden grid grid-cols-1 gap-3">
                {filteredRequests.map(req => {
                  const normType = (req.type || 'rm').toLowerCase();
                  const requester = req.requestedBy?.name || req.createdByName || 'User';
                  const dept = req.department || req.requestedBy?.department || 'General';
                  const dateStr = req.createdAt ? new Date(req.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
                  const itemsCount = req.items?.length || 0;

                  return (
                    <div
                      key={req._id}
                      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-md transition-all cursor-pointer shadow-2xs space-y-3 flex flex-col justify-between"
                      onClick={() => {
                        setSelectedRequestForDetails(req);
                        setIsDetailsModalOpen(true);
                      }}
                    >
                      <div>
                        {/* Top Row: Req # and Type & Status Badges */}
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                          <div>
                            <span className="font-mono font-black text-xs sm:text-sm text-blue-600 dark:text-blue-400">
                              {req.requestNumber}
                            </span>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <Calendar size={11} /> {dateStr}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${
                              normType === 'consumable' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300' :
                              normType === 'bo' || normType === 'bought-out' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300' :
                              normType === 'fg' || normType === 'inhouse' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300' :
                              'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300'
                            }`}>
                              {normType}
                            </span>

                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                              req.status === 'Issued' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' :
                              req.status === 'Approved' ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800' :
                              req.status === 'Rejected' ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800' :
                              'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800'
                            }`}>
                              {req.status}
                            </span>
                          </div>
                        </div>

                        {/* Items Preview List */}
                        <div className="mt-2.5 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl text-xs space-y-1.5 border border-slate-100 dark:border-slate-800">
                          {(req.items || []).slice(0, 2).map((it: any, iIdx: number) => (
                            <div key={iIdx} className="flex justify-between items-center text-xs">
                              <span className="truncate max-w-[70%] font-semibold text-slate-800 dark:text-slate-200">
                                • {it.materialName || it.name}
                              </span>
                              <span className="font-mono font-bold text-slate-900 dark:text-white text-[11px]">
                                {it.quantity} {it.unit || 'PCS'}
                              </span>
                            </div>
                          ))}
                          {itemsCount > 2 && (
                            <div className="text-[10px] text-blue-600 dark:text-blue-400 font-bold pt-0.5">
                              +{itemsCount - 2} more item(s)
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Footer Line: Requester & Details Link */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1 font-medium">
                          <User size={12} className="text-slate-400" /> {requester}
                          {dept && <span className="text-[10px] text-slate-400">({dept})</span>}
                        </span>

                        <span className="text-blue-600 dark:text-blue-400 font-bold flex items-center gap-0.5">
                          Details <ChevronRight size={13} />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* 5. SMALL FLOATING ACTION BUTTON (FAB) IN BOTTOM-RIGHT CORNER */}
      <button
        type="button"
        onClick={() => setIsCreateModalOpen(true)}
        className="fixed bottom-20 right-4 sm:bottom-8 sm:right-8 z-[110] p-3.5 sm:px-5 sm:py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full sm:rounded-2xl shadow-2xl hover:shadow-blue-500/30 flex items-center gap-2 cursor-pointer transition-all hover:scale-105 active:scale-95"
        title="Raise Material Request"
      >
        <Plus size={20} className="stroke-[3]" />
        <span className="hidden sm:inline text-xs font-black tracking-wide">Request Material</span>
      </button>

      {/* 6. MOBILE GLASSMORPHIC BOTTOM BAR (Like Gate Entry & Store Tabs) */}
      <div className="md:hidden fixed bottom-3 left-3 right-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-gray-200/80 dark:border-slate-700/80 shadow-2xl rounded-2xl z-[100] flex justify-around py-2.5 px-1 safe-area-pb">
        {navTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center gap-0.5 transition-all duration-200 w-full cursor-pointer ${
                isActive
                  ? "text-blue-600 dark:text-blue-400 scale-105"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all duration-200 ${isActive ? "bg-blue-50 dark:bg-blue-950/60 shadow-inner" : "bg-transparent"}`}>
                <Icon size={18} className={isActive ? "stroke-blue-600 dark:stroke-blue-400 stroke-[2.5px]" : "stroke-current"} />
              </div>
              {isActive && (
                <motion.span
                  layoutId="activeTabLabelMR"
                  className="text-[9px] font-bold tracking-tight"
                >
                  {tab.label}
                </motion.span>
              )}
            </button>
          );
        })}
      </div>

      {/* Creation Modal */}
      {isCreateModalOpen && (
        <MaterialRequestModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={handleCreateRequest}
          rawMaterials={rawMaterials}
          boughtOuts={boughtOuts}
          consumables={consumables}
          fgItems={fgItems}
          customerPos={customerPos}
          allowedTypes={allowedRequestTypes}
          defaultType={activeTab !== 'all' && activeTab !== 'ledger' ? (activeTab as RequestInventoryType) : allowedRequestTypes[0]}
        />
      )}

      {/* Details Modal */}
      {isDetailsModalOpen && selectedRequestForDetails && (
        <MaterialRequestDetailsModal
          isOpen={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
          request={selectedRequestForDetails}
        />
      )}
    </div>
  );
}

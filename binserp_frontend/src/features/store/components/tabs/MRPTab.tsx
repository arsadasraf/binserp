import React, { useState, useEffect, useMemo } from 'react';
import { 
  Layers, Plus, Search, Calendar, User, Eye, Trash2, Package, 
  CheckCircle2, Clock, Filter, ArrowRight, X, Building2, Printer, 
  LayoutGrid, List, Edit2, ShieldCheck, Download, ShoppingCart, 
  Sparkles, RefreshCw, FileText, AlertCircle 
} from 'lucide-react';
import Link from 'next/link';
import { apiGet, apiDelete } from '@/src/lib/api';
import Swal from 'sweetalert2';
import MRPModal from '../modals/MRPModal';
import MRPDetailsModal from '../modals/MRPDetailsModal';

interface MRPTabProps {
  token?: string | null;
  onError?: (msg: string) => void;
  onSuccess?: (msg: string) => void;
}

export default function MRPTab({ token: propToken, onError, onSuccess }: MRPTabProps) {
  const [loading, setLoading] = useState(true);
  const [mrpPlans, setMrpPlans] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [activeSubTab, setActiveSubTab] = useState<'plans' | 'rm-bo'>('plans');

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const token = propToken || (typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '');

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await apiGet('/api/purchase/mrp/plans', token);
      setMrpPlans(res.mrpPlans || []);
    } catch (err: any) {
      console.error('Failed to fetch MRP plans:', err);
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

  // Aggregated unified RM/BO list across all active plans
  const aggregatedRMBOList = useMemo(() => {
    const list: any[] = [];
    filteredPlans.forEach(plan => {
      const allMats = [...(plan.rmRequirements || []), ...(plan.boRequirements || [])];
      allMats.forEach((mat: any) => {
        list.push({
          ...mat,
          planId: plan._id,
          mrpNumber: plan.mrpNumber,
          customerName: plan.customerName,
          targetDate: plan.targetDate
        });
      });
    });
    return list;
  }, [filteredPlans]);

  // Metrics
  const totalPlansCount = mrpPlans.length;
  const totalMaterialCount = mrpPlans.reduce((sum, p) => 
    sum + (p.rmRequirements?.length || 0) + (p.boRequirements?.length || 0), 0);
  const totalShortagesCount = mrpPlans.reduce((sum, p) => {
    const allMats = [...(p.rmRequirements || []), ...(p.boRequirements || [])];
    const shorts = allMats.filter((m: any) => m.shortage > 0).length;
    return sum + shorts;
  }, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header & KPI Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers size={22} className="text-indigo-600" /> MRP & Material Planning
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Enter Finished Goods requirements with target dates, link optional customer, and calculate unified RM / BO material plans.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-xs font-bold shrink-0 bg-white dark:bg-slate-900"
            title="Refresh MRP Plans"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 hover:shadow-lg transition-all flex items-center gap-2"
          >
            <Plus size={16} /> Create MRP Plan
          </button>
        </div>
      </div>

      {/* Filter & Subtab Bar */}
      <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
        
        {/* Left Side: Sub-tab switcher and search box */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 min-w-0">
          
          {/* Sub-tab Switcher: Plans Orders vs RM / BO Materials */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold overflow-x-auto no-scrollbar max-w-full shrink-0">
            <button
              onClick={() => setActiveSubTab('plans')}
              className={`px-4 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 ${
                activeSubTab === 'plans' 
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm font-bold' 
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileText size={14} /> MRP Plans ({mrpPlans.length})
            </button>
            <button
              onClick={() => setActiveSubTab('rm-bo')}
              className={`px-4 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 ${
                activeSubTab === 'rm-bo' 
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm font-bold' 
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Package size={14} /> RM / BO Materials ({aggregatedRMBOList.length})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search MRP #, Customer, or Item..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50/50 dark:bg-slate-800/50"
            />
          </div>
        </div>

        {/* Right Side: Status Filter Pills */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold overflow-x-auto no-scrollbar max-w-full shrink-0">
          {['All', 'Planned', 'In Production', 'Partially Completed', 'In Procurement', 'Completed'].map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                filterStatus === status 
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm font-bold' 
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

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
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
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
                                    className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 rounded-lg transition-colors"
                                    title="View MRP Details"
                                  >
                                    <Eye size={16} />
                                  </button>
                                  <button
                                    onClick={(e) => handleDeletePlan(plan._id, e)}
                                    className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg transition-colors"
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
                              className="flex-1 py-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center gap-1 border border-indigo-200 dark:border-indigo-800"
                            >
                              <Eye size={13} /> View Plan
                            </button>
                            <button
                              onClick={(e) => handleDeletePlan(plan._id, e)}
                              className="py-1.5 px-2.5 text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-900/30 rounded-lg border border-rose-200 dark:border-rose-800"
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

          {/* TAB 2: UNIFIED RM / BO MATERIAL REQUIREMENTS */}
          {activeSubTab === 'rm-bo' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              {aggregatedRMBOList.length === 0 ? (
                <div className="p-16 text-center text-slate-400 text-xs">
                  No RM / BO material requirements found across active MRP plans.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="px-4 py-3.5">Material Name</th>
                        <th className="px-4 py-3.5">Category</th>
                        <th className="px-4 py-3.5">Source MRP</th>
                        <th className="px-4 py-3.5 text-center">Gross Required</th>
                        <th className="px-4 py-3.5 text-center">In-Stock</th>
                        <th className="px-4 py-3.5 text-center">Net Shortage</th>
                        <th className="px-4 py-3.5 text-right">Procure Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {aggregatedRMBOList.map((mat: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-4 py-3.5 font-bold text-slate-800 dark:text-slate-200">
                            {mat.materialName}
                            {mat.materialCode && <span className="block text-[10px] text-slate-400 font-mono font-normal">{mat.materialCode}</span>}
                          </td>

                          <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400 font-medium">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold">
                              {mat.category || 'RM / BO'}
                            </span>
                          </td>

                          <td className="px-4 py-3.5">
                            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 block text-xs">{mat.mrpNumber}</span>
                            {mat.customerName && <span className="text-[10px] text-slate-500">{mat.customerName}</span>}
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

                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Link
                                href={`/dashboard/store/purchase/rfq?materialId=${mat.material || ''}&qty=${mat.shortage || mat.requiredQuantity}&name=${encodeURIComponent(mat.materialName)}`}
                                className="px-2.5 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-bold text-[11px] transition-colors inline-flex items-center gap-1 shadow-2xs"
                              >
                                Outward RFQ
                              </Link>
                              <Link
                                href={`/dashboard/store/purchase/po?materialId=${mat.material || ''}&qty=${mat.shortage || mat.requiredQuantity}&name=${encodeURIComponent(mat.materialName)}`}
                                className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-[11px] transition-colors inline-flex items-center gap-1 shadow-2xs"
                              >
                                Outward PO
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
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

    </div>
  );
}

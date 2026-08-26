import React, { useState, useEffect, useMemo } from 'react';
import { 
  Layers, RefreshCw, Search, ArrowRight, CheckCircle2, 
  AlertTriangle, RotateCcw, Factory, Package, Calendar, 
  User, Eye, Sparkles, Filter, ChevronRight, Boxes
} from 'lucide-react';
import { apiGet } from '@/src/lib/api';
import MRP360WipDrawer from '../modals/MRP360WipDrawer';

interface MRP360WipTrackerProps {
  token: string;
}

export default function MRP360WipTracker({ token }: MRP360WipTrackerProps) {
  const [loading, setLoading] = useState(true);
  const [wipOverview, setWipOverview] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const fetchOverview = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await apiGet('/api/purchase/mrp/wip-overview', token);
      if (res?.data) {
        setWipOverview(res.data);
      }
    } catch (err) {
      console.error("Failed to load MRP WIP overview:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [token]);

  const filteredOverview = useMemo(() => {
    return wipOverview.filter((item: any) => {
      const s = searchTerm.toLowerCase();
      return !searchTerm ||
        item.mrpNumber.toLowerCase().includes(s) ||
        (item.customerName && item.customerName.toLowerCase().includes(s)) ||
        (item.customerPoNumber && item.customerPoNumber.toLowerCase().includes(s));
    });
  }, [wipOverview, searchTerm]);

  const handleOpen360Drawer = (planId: string) => {
    setSelectedPlanId(planId);
    setIsDrawerOpen(true);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="text-teal-600 w-5 h-5" />
            MRP 360° End-to-End WIP Tracking Control Center
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor real-time progress across all 4 production stages: Store Issue ➔ Shopfloor PPC ➔ Subcontracting ➔ FG Clearance.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={fetchOverview}
            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl transition-all"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* 2. Search Filter */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search MRP plan, Customer, PO number..."
          className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:ring-2 focus:ring-teal-500/20 outline-none"
        />
      </div>

      {/* 3. MRP WIP Cards Grid */}
      {loading ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-teal-600 mx-auto mb-2" />
          <p className="text-xs text-slate-500 font-semibold">Loading live shopfloor & subcontracting WIP metrics...</p>
        </div>
      ) : filteredOverview.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
          <Layers className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">No Active MRP WIP Plans Found</h3>
          <p className="text-xs text-slate-400 mt-1">
            Active MRP demand plans will appear here with live 4-stage tracking.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredOverview.map((item) => (
            <div
              key={item._id}
              onClick={() => handleOpen360Drawer(item._id)}
              className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-teal-400 dark:hover:border-teal-600 transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                {/* Header */}
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-black text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-800">
                        {item.mrpNumber}
                      </span>
                      {item.customerPoNumber && (
                        <span className="text-[10px] font-mono font-bold text-slate-400">
                          PO: {item.customerPoNumber}
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white mt-1.5 group-hover:text-teal-600 transition-colors">
                      {item.customerName}
                    </h3>
                  </div>

                  <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {item.status}
                  </span>
                </div>

                {/* 4 Pipeline Stage Progress Bar Grid */}
                <div className="mt-4 grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div>
                    <div className="flex justify-between text-[10px] font-bold text-slate-400">
                      <span>Store Issue</span>
                      <span className="text-teal-600">{item.stages?.materialIssue}%</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-1 overflow-hidden">
                      <div className="bg-teal-500 h-full rounded-full" style={{ width: `${item.stages?.materialIssue}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] font-bold text-slate-400">
                      <span>Subcontract</span>
                      <span className="text-indigo-600">{item.stages?.subcontracting}%</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-1 overflow-hidden">
                      <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${item.stages?.subcontracting}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] font-bold text-slate-400">
                      <span>FG Inward</span>
                      <span className="text-emerald-600">{item.stages?.fgCompletion}%</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-1 overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${item.stages?.fgCompletion}%` }} />
                    </div>
                  </div>
                </div>

                {/* Subcontracting Alert if any */}
                {item.pendingJobWorkUnits > 0 && (
                  <div className="mt-3 flex items-center gap-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800">
                    <RotateCcw size={12} />
                    <span>{item.pendingJobWorkUnits} unit(s) currently at Subcontractor Vendors awaiting return/QC</span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
                <div className="font-bold text-slate-500">
                  Target FG: <strong className="text-slate-900 dark:text-white">{item.receivedFG} / {item.targetFG} units</strong>
                </div>

                <div className="flex items-center gap-1 text-teal-600 font-bold text-xs group-hover:translate-x-0.5 transition-transform">
                  <span>Open 360° Matrix</span>
                  <ChevronRight size={14} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 360 WIP Drawer */}
      {selectedPlanId && (
        <MRP360WipDrawer
          isOpen={isDrawerOpen}
          onClose={() => {
            setIsDrawerOpen(false);
            setSelectedPlanId(null);
          }}
          mrpPlanId={selectedPlanId}
          token={token}
        />
      )}
    </div>
  );
}

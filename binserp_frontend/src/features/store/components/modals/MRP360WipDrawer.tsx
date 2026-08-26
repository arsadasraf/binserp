import React, { useState, useEffect } from 'react';
import { 
  X, CheckCircle2, AlertTriangle, RotateCcw, Package, 
  Layers, ArrowRight, RefreshCw, Calendar, User, Building2,
  Clock, ShieldCheck, FileText, Factory, ChevronRight, Boxes
} from 'lucide-react';
import { apiGet } from '@/src/lib/api';

interface MRP360WipDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  mrpPlanId: string;
  token: string;
}

export default function MRP360WipDrawer({
  isOpen,
  onClose,
  mrpPlanId,
  token
}: MRP360WipDrawerProps) {
  const [loading, setLoading] = useState(true);
  const [wipData, setWipData] = useState<any>(null);
  const [activeStageTab, setActiveStageTab] = useState<'stage1' | 'stage2' | 'stage3' | 'stage4'>('stage1');

  useEffect(() => {
    if (isOpen && mrpPlanId) {
      fetch360WipDetails();
    }
  }, [isOpen, mrpPlanId]);

  const fetch360WipDetails = async () => {
    setLoading(true);
    try {
      const res = await apiGet(`/api/purchase/mrp/wip-360/${mrpPlanId}`, token);
      if (res?.data) {
        setWipData(res.data);
      }
    } catch (err) {
      console.error("Failed to load MRP 360 WIP details:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const pipeline = wipData?.pipelineProgress;
  const mrpInfo = wipData?.mrpInfo;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl h-full flex flex-col shadow-2xl border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-300">
        
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/80 dark:bg-slate-900/80">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-black text-teal-600 bg-teal-50 dark:bg-teal-950 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-800">
                {mrpInfo?.mrpNumber || "MRP Plan"}
              </span>
              <span className="text-xs font-bold text-slate-500">
                {mrpInfo?.customerName || "Internal Production"}
              </span>
            </div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white mt-1 flex items-center gap-2">
              <Layers className="text-teal-600 w-5 h-5" />
              360° End-to-End WIP Tracking Matrix
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetch360WipDetails}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              title="Refresh"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Drawer Body */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <RefreshCw className="w-10 h-10 animate-spin text-teal-600 mb-3" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
              Aggregating 4 WIP stages from Store, PPC, Subcontractors & Quality...
            </p>
          </div>
        ) : !wipData ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <AlertTriangle className="w-10 h-10 text-amber-500 mb-3" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Could not load WIP tracking data.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            
            {/* 1. Interactive 4-Stage Visual Progress Tracker */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Live Production Pipeline Progress
                </span>
                <span className="text-xs font-extrabold text-teal-600 bg-teal-50 dark:bg-teal-950 px-2.5 py-0.5 rounded-full border border-teal-200">
                  Overall Completion: {pipeline?.overallProgress}%
                </span>
              </div>

              {/* 4 Pipeline Stages */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div 
                  onClick={() => setActiveStageTab('stage1')}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    activeStageTab === 'stage1' 
                      ? 'bg-white dark:bg-slate-900 border-teal-500 shadow-xs' 
                      : 'bg-slate-100 dark:bg-slate-800/80 border-transparent hover:border-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                    <span>STAGE 1</span>
                    <span className="text-teal-600">{pipeline?.stage1_MaterialIssue}%</span>
                  </div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">
                    Store Material Issue
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div className="bg-teal-500 h-full rounded-full" style={{ width: `${pipeline?.stage1_MaterialIssue}%` }} />
                  </div>
                </div>

                <div 
                  onClick={() => setActiveStageTab('stage2')}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    activeStageTab === 'stage2' 
                      ? 'bg-white dark:bg-slate-900 border-purple-500 shadow-xs' 
                      : 'bg-slate-100 dark:bg-slate-800/80 border-transparent hover:border-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                    <span>STAGE 2</span>
                    <span className="text-purple-600">{pipeline?.stage2_ShopfloorPPC}%</span>
                  </div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">
                    Shopfloor PPC
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div className="bg-purple-500 h-full rounded-full" style={{ width: `${pipeline?.stage2_ShopfloorPPC}%` }} />
                  </div>
                </div>

                <div 
                  onClick={() => setActiveStageTab('stage3')}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    activeStageTab === 'stage3' 
                      ? 'bg-white dark:bg-slate-900 border-indigo-500 shadow-xs' 
                      : 'bg-slate-100 dark:bg-slate-800/80 border-transparent hover:border-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                    <span>STAGE 3</span>
                    <span className="text-indigo-600">{pipeline?.stage3_JobWorkSubcontracting}%</span>
                  </div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">
                    Job Work Subcontract
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${pipeline?.stage3_JobWorkSubcontracting}%` }} />
                  </div>
                </div>

                <div 
                  onClick={() => setActiveStageTab('stage4')}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    activeStageTab === 'stage4' 
                      ? 'bg-white dark:bg-slate-900 border-emerald-500 shadow-xs' 
                      : 'bg-slate-100 dark:bg-slate-800/80 border-transparent hover:border-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                    <span>STAGE 4</span>
                    <span className="text-emerald-600">{pipeline?.stage4_FGAssembly}%</span>
                  </div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">
                    FG Inward Clearance
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${pipeline?.stage4_FGAssembly}%` }} />
                  </div>
                </div>
              </div>

              {/* Live Stage Status & Bottleneck Callout */}
              <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-bold text-amber-800 dark:text-amber-300">
                    Current Stage: {pipeline?.currentStage}
                  </span>
                  <p className="text-amber-700 dark:text-amber-400 mt-0.5">
                    {pipeline?.bottleneck || "No bottlenecks detected."}
                  </p>
                </div>
              </div>
            </div>

            {/* 2. Stage Details Drill-down */}
            
            {/* STAGE 1: MATERIAL ISSUES */}
            {activeStageTab === 'stage1' && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Boxes className="text-teal-600 w-4 h-4" />
                    Stage 1: Store Material Issuance ({wipData?.stage1_MaterialIssues?.materials?.length || 0} items)
                  </h3>
                  <span className="text-xs font-bold text-teal-600">
                    {wipData?.stage1_MaterialIssues?.overallProgress}% Issued to Shopfloor
                  </span>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-slate-500 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="p-3">Material Name</th>
                        <th className="p-3 text-center">Required Qty</th>
                        <th className="p-3 text-center">Issued to WIP</th>
                        <th className="p-3 text-center">Pending Store Issue</th>
                        <th className="p-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {wipData?.stage1_MaterialIssues?.materials?.map((mat: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          <td className="p-3">
                            <div className="font-bold text-slate-900 dark:text-white">{mat.materialName}</div>
                            {mat.materialCode && <span className="font-mono text-[10px] text-slate-400">{mat.materialCode}</span>}
                          </td>
                          <td className="p-3 text-center font-bold text-slate-700 dark:text-slate-300">
                            {mat.requiredQuantity} {mat.unit}
                          </td>
                          <td className="p-3 text-center font-bold text-teal-600">
                            {mat.issuedQuantity} {mat.unit}
                          </td>
                          <td className="p-3 text-center">
                            {mat.pendingToIssue > 0 ? (
                              <span className="font-bold text-red-500">{mat.pendingToIssue} {mat.unit}</span>
                            ) : (
                              <span className="font-bold text-emerald-600">0 (Complete)</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              mat.issuePercent >= 100 ? 'bg-emerald-100 text-emerald-700' :
                              mat.issuePercent > 0 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {mat.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* STAGE 2: SHOPFLOOR PPC JOBS */}
            {activeStageTab === 'stage2' && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Factory className="text-purple-600 w-4 h-4" />
                    Stage 2: Shopfloor PPC Route Cards & Machining ({wipData?.stage2_ShopfloorPPC?.jobs?.length || 0} jobs)
                  </h3>
                  <span className="text-xs font-bold text-purple-600">
                    {wipData?.stage2_ShopfloorPPC?.overallProgress}% Machining Progress
                  </span>
                </div>

                {wipData?.stage2_ShopfloorPPC?.jobs?.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <p className="text-xs text-slate-400">No PPC shopfloor jobs generated for this MRP yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {wipData?.stage2_ShopfloorPPC?.jobs?.map((job: any, idx: number) => (
                      <div key={idx} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-mono text-[10px] font-bold text-purple-600">{job.jobNumber}</span>
                            <h4 className="font-bold text-sm text-slate-900 dark:text-white">{job.partName}</h4>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 dark:bg-purple-950 text-purple-700 border border-purple-200">
                            {job.status}
                          </span>
                        </div>

                        <div className="mt-3 space-y-1 text-xs text-slate-500">
                          <div className="flex justify-between">
                            <span>Operation:</span>
                            <strong className="text-slate-700 dark:text-slate-300">{job.currentOperation}</strong>
                          </div>
                          <div className="flex justify-between">
                            <span>Machine:</span>
                            <strong className="text-slate-700 dark:text-slate-300">{job.machineName}</strong>
                          </div>
                          <div className="flex justify-between">
                            <span>Produced Qty:</span>
                            <strong className="text-purple-600 font-black">{job.completedQuantity} / {job.targetQuantity}</strong>
                          </div>
                        </div>

                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
                          <div className="bg-purple-500 h-full rounded-full" style={{ width: `${job.progressPercent}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* STAGE 3: SUBCONTRACTING JOB WORK */}
            {activeStageTab === 'stage3' && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <RotateCcw className="text-indigo-600 w-4 h-4" />
                    Stage 3: Subcontracting & Job Work ({wipData?.stage3_JobWork?.challans?.length || 0} Returnable DCs)
                  </h3>
                  <span className="text-xs font-bold text-indigo-600">
                    {wipData?.stage3_JobWork?.overallProgress}% Material Cleared
                  </span>
                </div>

                {wipData?.stage3_JobWork?.challans?.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <p className="text-xs text-slate-400">No Job Work subcontracting challans issued for this MRP plan.</p>
                  </div>
                ) : (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-slate-500 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="p-3">Challan No</th>
                          <th className="p-3">Subcontractor Vendor</th>
                          <th className="p-3">Process</th>
                          <th className="p-3 text-center">Sent</th>
                          <th className="p-3 text-center">Received</th>
                          <th className="p-3 text-center">Pending at Vendor</th>
                          <th className="p-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {wipData?.stage3_JobWork?.challans?.map((jw: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                            <td className="p-3 font-mono font-bold text-indigo-600">{jw.challanNumber}</td>
                            <td className="p-3 font-medium text-slate-800 dark:text-slate-200">{jw.vendorName}</td>
                            <td className="p-3 text-slate-600">{jw.processType}</td>
                            <td className="p-3 text-center font-bold">{jw.quantitySent}</td>
                            <td className="p-3 text-center font-bold text-emerald-600">{jw.quantityReceived}</td>
                            <td className="p-3 text-center font-bold text-amber-500">{jw.pendingAtVendor}</td>
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                jw.clearancePercent >= 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                              }`}>
                                {jw.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* STAGE 4: FG GRN INWARD */}
            {activeStageTab === 'stage4' && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <CheckCircle2 className="text-emerald-600 w-4 h-4" />
                    Stage 4: Finished Goods Inward ({wipData?.stage4_FGGRN?.receivedQuantity} / {wipData?.stage4_FGGRN?.targetQuantity} Units)
                  </h3>
                  <span className="text-xs font-bold text-emerald-600">
                    {wipData?.stage4_FGGRN?.overallProgress}% Target Finished
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
                    <span className="text-[10px] font-extrabold uppercase text-slate-400">Order Target FG Quantity</span>
                    <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                      {wipData?.stage4_FGGRN?.targetQuantity} <span className="text-xs font-semibold text-slate-400">units</span>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
                    <span className="text-[10px] font-extrabold uppercase text-emerald-600">FG Store Received</span>
                    <div className="text-2xl font-black text-emerald-600 mt-1">
                      {wipData?.stage4_FGGRN?.receivedQuantity} <span className="text-xs font-semibold text-slate-400">units inwarded</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end bg-slate-50 dark:bg-slate-900/80">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs rounded-xl shadow-xs"
          >
            Close 360° Matrix
          </button>
        </div>
      </div>
    </div>
  );
}

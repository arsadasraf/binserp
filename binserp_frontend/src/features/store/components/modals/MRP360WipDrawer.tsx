import React, { useState, useEffect } from 'react';
import { 
  X, CheckCircle2, AlertTriangle, RotateCcw, Package, 
  Layers, ArrowRight, RefreshCw, Calendar, User, Building2,
  Clock, ShieldCheck, FileText, Factory, ChevronRight, Boxes,
  ChevronDown, ChevronUp, Sparkles, TrendingUp, AlertCircle, Truck
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
  const [activeStageTab, setActiveStageTab] = useState<'stage1' | 'stage2'>('stage1');
  const [expandedItemHistory, setExpandedItemHistory] = useState<Record<string, boolean>>({});

  const toggleHistory = (key: string) => {
    setExpandedItemHistory(prev => ({ ...prev, [key]: !prev[key] }));
  };

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
  const stage1 = wipData?.stage1_MaterialIssues;
  const stage2 = wipData?.stage2_FGGRN || wipData?.stage4_FGGRN;

  const bomMaterials = stage1?.materials || [];
  const nonBomMaterials = stage1?.nonBomMaterials || [];
  const overIssuedBOMCount = bomMaterials.filter((m: any) => m.isOverIssued).length;

  const plannedFGItems = stage2?.plannedItems || [];
  const unplannedFGItems = stage2?.unplannedItems || [];
  const surplusFGCount = plannedFGItems.filter((f: any) => f.isSurplus).length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl h-full flex flex-col shadow-2xl border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-300">
        
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/80 dark:bg-slate-900/80 shrink-0">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-black text-teal-600 bg-teal-50 dark:bg-teal-950 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-800">
                {mrpInfo?.mrpNumber || "MRP Plan"}
              </span>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                {mrpInfo?.customerName || "Internal Production"}
              </span>
              {mrpInfo?.customerPoNumber && (
                <span className="text-[11px] font-mono text-slate-400">
                  (PO: {mrpInfo.customerPoNumber})
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-1 flex items-center gap-2">
              <Layers className="text-teal-600 w-5 h-5 shrink-0" />
              <span>360° End-to-End WIP Tracking Matrix</span>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetch360WipDetails}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="Refresh"
            >
              <RefreshCw size={15} className={loading ? "animate-spin text-teal-600" : ""} />
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
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
              Aggregating 2-stage store material issues, Returnable DCs & FG GRN inwards...
            </p>
          </div>
        ) : !wipData ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <AlertTriangle className="w-10 h-10 text-amber-500 mb-3" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Could not load WIP tracking data.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            
            {/* 1. Two-Stage Visual Progress Tracker */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-xs">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Two-Stage Store Pipeline Progress
                </span>
                <span className="text-xs font-extrabold text-teal-600 bg-teal-50 dark:bg-teal-950 px-2.5 py-0.5 rounded-full border border-teal-200 dark:border-teal-800">
                  Overall Completion: {pipeline?.overallProgress}%
                </span>
              </div>

              {/* 2 Pipeline Stage Tabs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* STAGE 1 TAB */}
                <div 
                  onClick={() => setActiveStageTab('stage1')}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    activeStageTab === 'stage1' 
                      ? 'bg-white dark:bg-slate-900 border-teal-500 shadow-md ring-2 ring-teal-500/20' 
                      : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-teal-300'
                  }`}
                >
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                    <span className="uppercase tracking-wider">STAGE 1</span>
                    <span className="text-teal-600 font-mono font-black">{pipeline?.stage1_MaterialIssue}%</span>
                  </div>
                  <div className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white mt-1 flex items-center justify-between">
                    <span>Store Material Issuance</span>
                    <Boxes size={15} className="text-teal-600 shrink-0" />
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Direct Store Issue + Returnable DC
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full mt-2.5 overflow-hidden">
                    <div className="bg-teal-500 h-full rounded-full transition-all duration-500" style={{ width: `${pipeline?.stage1_MaterialIssue}%` }} />
                  </div>
                </div>

                {/* STAGE 2 TAB */}
                <div 
                  onClick={() => setActiveStageTab('stage2')}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    activeStageTab === 'stage2' 
                      ? 'bg-white dark:bg-slate-900 border-emerald-500 shadow-md ring-2 ring-emerald-500/20' 
                      : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-emerald-300'
                  }`}
                >
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                    <span className="uppercase tracking-wider">STAGE 2</span>
                    <span className="text-emerald-600 font-mono font-black">{pipeline?.stage2_FGReturn || pipeline?.stage4_FGAssembly}%</span>
                  </div>
                  <div className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white mt-1 flex items-center justify-between">
                    <span>FG GRN Inward & Clearance</span>
                    <Package size={15} className="text-emerald-600 shrink-0" />
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Production Inwards & Surplus Receipts
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full mt-2.5 overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${pipeline?.stage2_FGReturn || pipeline?.stage4_FGAssembly}%` }} />
                  </div>
                </div>
              </div>

              {/* Bottleneck / Live State Callout */}
              <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-bold text-amber-900 dark:text-amber-200">
                    Pipeline Status: {pipeline?.currentStage}
                  </span>
                  <p className="text-amber-700 dark:text-amber-300 mt-0.5">
                    {pipeline?.bottleneck || "Store material issuance and FG inward clearance running normally."}
                  </p>
                </div>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* STAGE 1 DRILL-DOWN: STORE MATERIAL ISSUES (Direct Issue + Returnable DC)  */}
            {/* ========================================================================= */}
            {activeStageTab === 'stage1' && (
              <div className="space-y-4">
                
                {/* Stage 1 KPI Summary Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700/60">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Planned BOM Items</span>
                    <div className="text-lg font-black text-slate-800 dark:text-slate-100 mt-0.5">
                      {bomMaterials.length} <span className="text-[10px] text-slate-400 font-normal">materials</span>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700/60">
                    <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider block">Store Documents</span>
                    <div className="text-lg font-black text-teal-600 mt-0.5">
                      {(stage1?.directIssuesCount || 0) + (stage1?.returnableDcsCount || 0)}
                      <span className="text-[10px] text-slate-400 font-normal ml-1">
                        ({stage1?.directIssuesCount || 0} issues, {stage1?.returnableDcsCount || 0} DCs)
                      </span>
                    </div>
                  </div>

                  <div className={`p-3 rounded-xl border ${
                    nonBomMaterials.length > 0 
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800' 
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60'
                  }`}>
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block">Non-BOM Extra Items</span>
                    <div className="text-lg font-black text-amber-700 dark:text-amber-300 mt-0.5">
                      {nonBomMaterials.length} <span className="text-[10px] font-normal">extra items</span>
                    </div>
                  </div>

                  <div className={`p-3 rounded-xl border ${
                    overIssuedBOMCount > 0 
                      ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800' 
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60'
                  }`}>
                    <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider block">Over-Issued Items</span>
                    <div className="text-lg font-black text-rose-700 dark:text-rose-300 mt-0.5">
                      {overIssuedBOMCount} <span className="text-[10px] font-normal">items over-limit</span>
                    </div>
                  </div>
                </div>

                {/* Section 1A: Planned BOM Materials */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                      <Boxes className="text-teal-600 w-4 h-4" />
                      <span>Planned BOM Materials ({bomMaterials.length} items)</span>
                    </h3>
                    <span className="text-xs font-bold text-teal-600">
                      {stage1?.overallProgress}% Fulfilled from Store
                    </span>
                  </div>

                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-slate-500 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="p-3">Material Name & Description</th>
                          <th className="p-3 text-center">Type</th>
                          <th className="p-3 text-center">Required Qty</th>
                          <th className="p-3 text-center">Issued from Store</th>
                          <th className="p-3 text-center">Pending Store Issue</th>
                          <th className="p-3 text-center">Status / Increase</th>
                          <th className="p-3 text-center">Doc Log</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {bomMaterials.map((mat: any, idx: number) => {
                          const historyKey = `bom-${idx}`;
                          const isExpanded = Boolean(expandedItemHistory[historyKey]);

                          return (
                            <React.Fragment key={idx}>
                              <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                                {/* Name & Description (Strict AGENTS.md compliance) */}
                                <td className="p-3">
                                  <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                                    {mat.materialName}
                                  </div>
                                  {mat.description && (
                                    <span className="block text-[11px] text-slate-500 italic mt-0.5 line-clamp-2">
                                      {mat.description}
                                    </span>
                                  )}
                                </td>

                                <td className="p-3 text-center font-medium text-slate-500 text-[11px]">
                                  <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                                    {mat.itemType}
                                  </span>
                                </td>

                                <td className="p-3 text-center font-bold text-slate-700 dark:text-slate-300">
                                  {mat.requiredQuantity} {mat.unit}
                                </td>

                                {/* Total Issued with Channel Badges */}
                                <td className="p-3 text-center font-bold">
                                  <div className="text-teal-600 font-mono font-bold">
                                    {mat.issuedQuantity} {mat.unit}
                                  </div>
                                  {(mat.directIssueQuantity > 0 || mat.returnableDcQuantity > 0) && (
                                    <div className="flex items-center justify-center gap-1 mt-0.5 flex-wrap">
                                      {mat.directIssueQuantity > 0 && (
                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                                          Store: {mat.directIssueQuantity}
                                        </span>
                                      )}
                                      {mat.returnableDcQuantity > 0 && (
                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                          DC: {mat.returnableDcQuantity}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </td>

                                <td className="p-3 text-center font-bold">
                                  {mat.pendingToIssue > 0 ? (
                                    <span className="text-rose-600 font-mono">{mat.pendingToIssue} {mat.unit}</span>
                                  ) : (
                                    <span className="text-emerald-600">0</span>
                                  )}
                                </td>

                                {/* Status / Over-Issue Tag */}
                                <td className="p-3 text-center">
                                  {mat.isOverIssued ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 flex items-center justify-center gap-1">
                                      <TrendingUp size={10} />
                                      <span>Over-Issued (+{mat.excessQuantity} {mat.unit})</span>
                                    </span>
                                  ) : mat.issuePercent >= 100 ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200">
                                      Fully Issued
                                    </span>
                                  ) : mat.issuePercent > 0 ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200">
                                      Partial ({mat.issuePercent}%)
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">
                                      Not Issued
                                    </span>
                                  )}
                                </td>

                                {/* Expand History Button */}
                                <td className="p-3 text-center">
                                  {mat.issueHistory?.length > 0 ? (
                                    <button
                                      type="button"
                                      onClick={() => toggleHistory(historyKey)}
                                      className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors cursor-pointer"
                                      title="View Issuance Documents"
                                    >
                                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    </button>
                                  ) : (
                                    <span className="text-slate-300">—</span>
                                  )}
                                </td>
                              </tr>

                              {/* Expanded Document Breakdown */}
                              {isExpanded && mat.issueHistory?.length > 0 && (
                                <tr className="bg-slate-50/80 dark:bg-slate-800/40">
                                  <td colSpan={7} className="p-3 pl-8 text-xs">
                                    <div className="space-y-1.5">
                                      <span className="font-bold text-slate-600 dark:text-slate-400 block text-[11px]">
                                        Material Issuance Documents for {mat.materialName}:
                                      </span>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {mat.issueHistory.map((h: any, hIdx: number) => (
                                          <div key={hIdx} className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 flex justify-between items-center text-[11px]">
                                            <div className="flex items-center gap-2">
                                              <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold ${
                                                h.sourceType === 'Returnable DC' 
                                                  ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' 
                                                  : 'bg-teal-100 text-teal-800 border border-teal-200'
                                              }`}>
                                                {h.sourceType}
                                              </span>
                                              <strong className="font-mono text-slate-800 dark:text-slate-200">{h.docNumber}</strong>
                                              <span className="text-slate-400">({new Date(h.date).toLocaleDateString()})</span>
                                            </div>
                                            <div className="text-right">
                                              <span className="font-bold text-teal-600">{h.quantity} {h.unit}</span>
                                              <span className="text-[10px] text-slate-400 block">{h.recipient}</span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Section 1B: Non-BOM Extra Store Materials Issued */}
                {nonBomMaterials.length > 0 && (
                  <div className="space-y-2 p-3.5 bg-amber-50/50 dark:bg-amber-950/20 rounded-2xl border border-amber-200 dark:border-amber-900/40">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider flex items-center gap-2">
                        <AlertTriangle className="text-amber-600 w-4 h-4" />
                        <span>Non-BOM / Extra Store Materials Issued for this MRP ({nonBomMaterials.length} items)</span>
                      </h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 border border-amber-300">
                        Ad-hoc Store Issuances
                      </span>
                    </div>

                    <div className="border border-amber-200 dark:border-amber-900/50 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-xs">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-amber-100/50 dark:bg-amber-950/40 font-bold text-amber-900 dark:text-amber-300 border-b border-amber-200 dark:border-amber-900/40">
                          <tr>
                            <th className="p-2.5">Material Name & Description</th>
                            <th className="p-2.5 text-center">Issued Qty</th>
                            <th className="p-2.5 text-center">Channels</th>
                            <th className="p-2.5 text-center">Over-Issue Flag</th>
                            <th className="p-2.5 text-center">History</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-100 dark:divide-amber-900/30">
                          {nonBomMaterials.map((mat: any, idx: number) => {
                            const historyKey = `nonbom-${idx}`;
                            const isExpanded = Boolean(expandedItemHistory[historyKey]);

                            return (
                              <React.Fragment key={idx}>
                                <tr className="hover:bg-amber-50/40 dark:hover:bg-amber-950/20">
                                  <td className="p-2.5">
                                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                      <span>{mat.materialName}</span>
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                        Non-BOM
                                      </span>
                                    </div>
                                    {mat.description && (
                                      <span className="block text-[11px] text-slate-500 italic mt-0.5">
                                        {mat.description}
                                      </span>
                                    )}
                                  </td>

                                  <td className="p-2.5 text-center font-bold text-amber-800 dark:text-amber-300 font-mono">
                                    {mat.issuedQuantity} {mat.unit}
                                  </td>

                                  <td className="p-2.5 text-center">
                                    <div className="flex items-center justify-center gap-1 flex-wrap">
                                      {mat.directIssueQuantity > 0 && (
                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                                          Store: {mat.directIssueQuantity}
                                        </span>
                                      )}
                                      {mat.returnableDcQuantity > 0 && (
                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                          DC: {mat.returnableDcQuantity}
                                        </span>
                                      )}
                                    </div>
                                  </td>

                                  <td className="p-2.5 text-center">
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300 flex items-center justify-center gap-1">
                                      <TrendingUp size={10} />
                                      <span>+{mat.excessQuantity} {mat.unit}</span>
                                    </span>
                                  </td>

                                  <td className="p-2.5 text-center">
                                    {mat.issueHistory?.length > 0 ? (
                                      <button
                                        type="button"
                                        onClick={() => toggleHistory(historyKey)}
                                        className="p-1 rounded-lg hover:bg-amber-100 text-amber-700 transition-colors cursor-pointer"
                                      >
                                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                      </button>
                                    ) : (
                                      <span className="text-slate-300">—</span>
                                    )}
                                  </td>
                                </tr>

                                {isExpanded && mat.issueHistory?.length > 0 && (
                                  <tr className="bg-amber-50/60 dark:bg-amber-950/30">
                                    <td colSpan={5} className="p-2.5 pl-6 text-xs">
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {mat.issueHistory.map((h: any, hIdx: number) => (
                                          <div key={hIdx} className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-amber-200 dark:border-amber-900/60 flex justify-between items-center text-[11px]">
                                            <div className="flex items-center gap-1.5">
                                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                                                {h.sourceType}
                                              </span>
                                              <strong className="font-mono text-slate-800 dark:text-slate-200">{h.docNumber}</strong>
                                            </div>
                                            <div className="text-right">
                                              <span className="font-bold text-amber-700">{h.quantity} {h.unit}</span>
                                              <span className="text-[10px] text-slate-400 block">{h.recipient}</span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
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
            {/* STAGE 2 DRILL-DOWN: FG GRN INWARD & PRODUCTION CLEARANCE                 */}
            {/* ========================================================================= */}
            {activeStageTab === 'stage2' && (
              <div className="space-y-4">
                
                {/* Stage 2 KPI Summary Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700/60">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target FG Quantity</span>
                    <div className="text-lg font-black text-slate-800 dark:text-slate-100 mt-0.5">
                      {stage2?.targetQuantity || 0} <span className="text-[10px] text-slate-400 font-normal">units</span>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700/60">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">FG GRN Inwarded</span>
                    <div className="text-lg font-black text-emerald-600 mt-0.5">
                      {stage2?.receivedQuantity || 0} <span className="text-[10px] text-slate-400 font-normal">units</span>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700/60">
                    <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Pending FG Production</span>
                    <div className="text-lg font-black text-amber-600 mt-0.5">
                      {Math.max(0, (stage2?.targetQuantity || 0) - (stage2?.receivedQuantity || 0))}
                      <span className="text-[10px] text-slate-400 font-normal ml-1">units</span>
                    </div>
                  </div>

                  <div className={`p-3 rounded-xl border ${
                    (stage2?.surplusQuantity || 0) > 0 
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800' 
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60'
                  }`}>
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">Surplus Production</span>
                    <div className="text-lg font-black text-emerald-700 dark:text-emerald-300 mt-0.5">
                      +{(stage2?.surplusQuantity || 0)} <span className="text-[10px] font-normal">extra units</span>
                    </div>
                  </div>
                </div>

                {/* Section 2A: Planned Finished Goods Items */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                      <Package className="text-emerald-600 w-4 h-4" />
                      <span>Planned Finished Goods Demand ({plannedFGItems.length} items)</span>
                    </h3>
                    <span className="text-xs font-bold text-emerald-600">
                      {stage2?.overallProgress}% Completed
                    </span>
                  </div>

                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-slate-500 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="p-3">Finished Good (FG) Name & Description</th>
                          <th className="p-3 text-center">BOM No</th>
                          <th className="p-3 text-center">Target Qty</th>
                          <th className="p-3 text-center">GRN Received</th>
                          <th className="p-3 text-center">Balance Qty</th>
                          <th className="p-3 text-center">Status / Increase</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {plannedFGItems.map((fg: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                            {/* FG Name & Description (Strict AGENTS.md compliance) */}
                            <td className="p-3">
                              <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                                {fg.fgItemName}
                              </div>
                              {fg.description && (
                                <span className="block text-[11px] text-slate-500 italic mt-0.5 line-clamp-2">
                                  {fg.description}
                                </span>
                              )}
                            </td>

                            <td className="p-3 text-center font-mono text-[10px] text-slate-500">
                              <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                                {fg.bomNumber}
                              </span>
                            </td>

                            <td className="p-3 text-center font-bold text-slate-800 dark:text-slate-200">
                              {fg.targetQuantity} {fg.unit}
                            </td>

                            <td className="p-3 text-center font-bold text-emerald-600 font-mono">
                              {fg.receivedQuantity} {fg.unit}
                            </td>

                            <td className="p-3 text-center font-bold">
                              {fg.balanceQuantity > 0 ? (
                                <span className="text-amber-600 font-mono">{fg.balanceQuantity} {fg.unit}</span>
                              ) : (
                                <span className="text-emerald-600">0</span>
                              )}
                            </td>

                            <td className="p-3 text-center">
                              {fg.isSurplus ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 flex items-center justify-center gap-1">
                                  <Sparkles size={11} className="text-emerald-600" />
                                  <span>Surplus (+{fg.surplusQuantity} {fg.unit})</span>
                                </span>
                              ) : fg.completionPercent >= 100 ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200">
                                  100% Inwarded
                                </span>
                              ) : fg.completionPercent > 0 ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200">
                                  Partial ({fg.completionPercent}%)
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">
                                  Pending Inward
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Section 2B: Unplanned / Extra FG Inwards */}
                {unplannedFGItems.length > 0 && (
                  <div className="space-y-2 p-3.5 bg-purple-50/50 dark:bg-purple-950/20 rounded-2xl border border-purple-200 dark:border-purple-900/40">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-purple-900 dark:text-purple-200 uppercase tracking-wider flex items-center gap-2">
                        <Sparkles className="text-purple-600 w-4 h-4" />
                        <span>Unplanned Finished Goods Received ({unplannedFGItems.length} items)</span>
                      </h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300">
                        Extra FG Returns
                      </span>
                    </div>

                    <div className="border border-purple-200 dark:border-purple-900/50 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-xs">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-purple-100/50 dark:bg-purple-950/40 font-bold text-purple-900 dark:text-purple-300 border-b border-purple-200 dark:border-purple-900/40">
                          <tr>
                            <th className="p-2.5">Finished Good (FG) Name & Description</th>
                            <th className="p-2.5 text-center">GRN Received</th>
                            <th className="p-2.5 text-center">Surplus Tag</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-purple-100 dark:divide-purple-900/30">
                          {unplannedFGItems.map((fg: any, idx: number) => (
                            <tr key={idx} className="hover:bg-purple-50/40 dark:hover:bg-purple-950/20">
                              <td className="p-2.5">
                                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                  <span>{fg.fgItemName}</span>
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-100 text-purple-800 border border-purple-300">
                                    Unplanned
                                  </span>
                                </div>
                                {fg.description && (
                                  <span className="block text-[11px] text-slate-500 italic mt-0.5">
                                    {fg.description}
                                  </span>
                                )}
                              </td>

                              <td className="p-2.5 text-center font-bold text-purple-700 font-mono">
                                {fg.receivedQuantity} {fg.unit}
                              </td>

                              <td className="p-2.5 text-center">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-300">
                                  +{fg.receivedQuantity} {fg.unit} Extra
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Section 2C: Detailed FG GRN Receipts Log */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="text-slate-500 w-4 h-4" />
                    <span>FG GRN Receipts Log ({stage2?.receipts?.length || 0} GRNs Recorded)</span>
                  </h4>

                  {(!stage2?.receipts || stage2.receipts.length === 0) ? (
                    <div className="p-6 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                      No FG GRN inward receipts recorded for this MRP plan yet.
                    </div>
                  ) : (
                    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-slate-500 border-b border-slate-200 dark:border-slate-700">
                          <tr>
                            <th className="p-3">GRN Number</th>
                            <th className="p-3">Date</th>
                            <th className="p-3">Received By</th>
                            <th className="p-3">Items Inwarded</th>
                            <th className="p-3 text-center">QC Status</th>
                            <th className="p-3">Remarks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {stage2.receipts.map((grn: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                              <td className="p-3 font-mono font-bold text-indigo-600">
                                {grn.grnNumber}
                              </td>

                              <td className="p-3 text-slate-600 dark:text-slate-300">
                                {new Date(grn.date).toLocaleDateString()}
                              </td>

                              <td className="p-3 text-slate-700 dark:text-slate-200 font-medium">
                                {grn.receivedBy?.name || "Store Executive"}
                              </td>

                              <td className="p-3">
                                <div className="space-y-1">
                                  {(grn.items || []).map((it: any, iIdx: number) => (
                                    <div key={iIdx} className="text-[11px]">
                                      <strong className="text-slate-900 dark:text-white">
                                        {it.fgItem?.name || it.itemName}
                                      </strong>: <span className="font-mono text-emerald-600 font-bold">
                                        {it.acceptedQuantity != null ? it.acceptedQuantity : (it.quantity || it.receivedQuantity)} {it.unit || 'Nos'}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </td>

                              <td className="p-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  grn.qcStatus === 'Completed' || grn.qcStatus === 'Skipped' 
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' 
                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                }`}>
                                  {grn.qcStatus || 'Completed'}
                                </span>
                              </td>

                              <td className="p-3 text-slate-500 text-[11px] truncate max-w-[150px]">
                                {grn.remarks || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

              </div>
            )}

          </div>
        )}

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end bg-slate-50 dark:bg-slate-900/80 shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            Close 360° Matrix
          </button>
        </div>
      </div>
    </div>
  );
}

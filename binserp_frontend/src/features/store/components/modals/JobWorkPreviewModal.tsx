import React, { useState } from 'react';
import { 
  X, Calendar, User, Truck, Package, Layers, FileText, 
  FileSpreadsheet, Check, CheckCircle2, Factory, Clock, 
  ArrowRight, ShieldCheck, Edit3, Trash2, Zap, Sparkles, 
  Eye, Download, ExternalLink, Camera, Lock
} from 'lucide-react';
import { JobWorkChallan, JobWorkReturningItem, Vendor } from "@/src/features/store/types/store.types";
import { generateDocument } from '@/src/utils/documentHelper';
import { useTimeLockPolicy } from '@/src/hooks/useTimeLockPolicy';
import { apiDelete } from '@/src/lib/api';
import { showDestructiveConfirm, showSuccessToast, showErrorDialog } from '@/src/features/store/utils/storeDialogHelper';
import { getSafeBlobUrl, openSafeUrlInNewTab, downloadDataUrl } from '@/src/utils/dataUrlHelper';
import EditJobWorkReturnModal from './EditJobWorkReturnModal';

interface JobWorkPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    challan: JobWorkChallan | null;
    vendors?: Vendor[];
    jobWorkSuppliers?: any[];
    companyInfo?: any;
    token?: string | null;
    onRefresh?: () => void;
    onEdit?: (challan: JobWorkChallan) => void;
    onReceive?: (challan: JobWorkChallan) => void;
    onDelete?: (id: string) => void;
}

export default function JobWorkPreviewModal({
    isOpen,
    onClose,
    challan,
    vendors = [],
    jobWorkSuppliers = [],
    companyInfo,
    token,
    onRefresh,
    onEdit,
    onReceive,
    onDelete
}: JobWorkPreviewModalProps) {
    const { getPolicyHours, getRemainingSeconds, isTimeLockExpired, formatRemainingTime } = useTimeLockPolicy(token);

    const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
    const [previewPdfModal, setPreviewPdfModal] = useState<{ url: string; filename: string } | null>(null);
    const [editingReceipt, setEditingReceipt] = useState<any | null>(null);
    if (!isOpen || !challan) return null;

    // Resolve full vendor object
    let vendorObj: any = challan.vendor;
    if (typeof challan.vendor === 'string') {
        const combined = [...jobWorkSuppliers, ...vendors];
        vendorObj = combined.find((v: any) => v._id === challan.vendor) || { name: challan.vendor };
    }

    const vendorName = vendorObj?.name || vendorObj?.vendorName || (challan as any).vendorName || 'Supplier';
    const vendorAddress = vendorObj?.address || vendorObj?.billingAddress || vendorObj?.street || '';
    const vendorCityState = `${vendorObj?.city || ''} ${vendorObj?.state || ''} ${vendorObj?.pincode ? '-' + vendorObj?.pincode : ''}`.trim();
    const vendorGst = vendorObj?.gst || vendorObj?.gstNumber || vendorObj?.gstin || 'N/A';
    const vendorPan = vendorObj?.pan || vendorObj?.panNumber || 'N/A';
    const vendorPhone = vendorObj?.phone || vendorObj?.contactNumber || vendorObj?.mobile || '';
    const vendorEmail = vendorObj?.email || '';

    const handleDownloadPDF = () => {
        const allVendors = [...jobWorkSuppliers, ...vendors];
        generateDocument('pdf', 'returnable_dc', { doc: challan, companyInfo, vendors: allVendors });
    };

    const handleDownloadExcel = () => {
        generateDocument('excel', 'Returnable DC', [challan]);
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-5xl my-auto overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]">
                
                {/* Header */}
                <div className="p-6 bg-indigo-950 text-white flex justify-between items-center flex-shrink-0 border-b border-indigo-900">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-indigo-900/90 rounded-2xl flex items-center justify-center border border-indigo-700/60 shadow-inner">
                            <Factory className="text-indigo-300 w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h2 className="text-xl font-extrabold tracking-tight font-mono text-indigo-100">
                                    {challan.challanNumber}
                                </h2>
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                                    challan.status === 'Open' ? 'bg-blue-500/20 text-blue-300 border border-blue-400/30' :
                                    challan.status === 'Partial' ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30' :
                                    challan.status === 'Closed' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' :
                                    'bg-red-500/20 text-red-300 border border-red-400/30'
                                }`}>
                                    {challan.status}
                                </span>
                                {challan.operationMode === 'assembly' ? (
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30 flex items-center gap-1">
                                        <Zap size={11} /> Many to One (Many Outward ➔ 1 Inward)
                                    </span>
                                ) : (
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 flex items-center gap-1">
                                        One to Many Flow
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-indigo-300/80 mt-0.5">
                                Job-Work Outward Returnable Delivery Challan
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-9 h-9 rounded-full bg-indigo-900 hover:bg-indigo-800 transition-all flex items-center justify-center text-white border border-indigo-700"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-6 sm:p-7 overflow-y-auto flex-1 space-y-6">
                    
                    {/* Top Stats & Logistics Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        
                        {/* Box 1: Supplier & Vendor Complete Details */}
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-200/70 dark:border-slate-700 pb-2">
                                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <User size={14} /> Subcontractor / Consignee Details
                                </span>
                                <span className="text-[11px] font-semibold text-slate-400">Supplier Info</span>
                            </div>

                            <div>
                                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                                    {vendorName}
                                </h3>
                                {vendorAddress && <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">{vendorAddress}</p>}
                                {vendorCityState && <p className="text-xs text-slate-500 dark:text-slate-400">{vendorCityState}</p>}
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700 text-xs">
                                <div>
                                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">GSTIN Number</span>
                                    <strong className="text-slate-800 dark:text-slate-200 font-mono">{vendorGst}</strong>
                                </div>
                                <div>
                                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">PAN Number</span>
                                    <strong className="text-slate-800 dark:text-slate-200 font-mono">{vendorPan}</strong>
                                </div>
                                {vendorPhone && (
                                    <div className="col-span-2">
                                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Contact Phone / Mobile</span>
                                        <strong className="text-slate-800 dark:text-slate-200">{vendorPhone}</strong>
                                    </div>
                                )}
                                {vendorEmail && (
                                    <div className="col-span-2">
                                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Contact Email</span>
                                        <strong className="text-slate-800 dark:text-slate-200">{vendorEmail}</strong>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Box 2: Transport, PO & Dates Summary */}
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-200/70 dark:border-slate-700 pb-2">
                                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <Truck size={14} /> Logistics & Document Details
                                </span>
                                {challan.ewayBillNo && (
                                    <span className="bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[11px] font-mono font-bold px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                                        E-Way: {challan.ewayBillNo}
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div>
                                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Challan Date</span>
                                    <strong className="text-slate-900 dark:text-white font-bold">{new Date(challan.date).toLocaleDateString('en-GB')}</strong>
                                </div>

                                <div>
                                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Expected Return Due</span>
                                    <strong className={`font-bold ${challan.expectedReturnDate && new Date(challan.expectedReturnDate) < new Date() && challan.status !== 'Closed' ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}>
                                        {challan.expectedReturnDate ? new Date(challan.expectedReturnDate).toLocaleDateString('en-GB') : 'Not Set'}
                                    </strong>
                                </div>

                                <div>
                                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Our PO Number</span>
                                    <strong className="text-slate-800 dark:text-slate-200">{challan.poNumber || 'N/A'}</strong>
                                </div>

                                <div>
                                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Vehicle Number</span>
                                    <strong className="text-slate-800 dark:text-slate-200">{challan.vehicleNo || 'N/A'}</strong>
                                </div>

                                <div>
                                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Freight Terms</span>
                                    <strong className="text-slate-800 dark:text-slate-200">{challan.freightType || 'To Pay'}</strong>
                                </div>

                                <div>
                                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Estimated Weight</span>
                                    <strong className="text-slate-800 dark:text-slate-200">{challan.estimatedWeight ? `${challan.estimatedWeight} Kgs` : 'N/A'}</strong>
                                </div>

                                {/* Purpose of Outward Movement Banner */}
                                <div className="col-span-2 bg-indigo-50/70 dark:bg-indigo-950/40 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-900 flex items-center justify-between">
                                    <div>
                                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 uppercase font-bold block">Purpose of Outward Movement</span>
                                        <strong className="text-indigo-950 dark:text-indigo-200 font-extrabold text-sm flex items-center gap-1.5 mt-0.5">
                                            🎯 {challan.purpose === 'Others' && challan.otherPurpose ? challan.otherPurpose : (challan.purpose || challan.items?.[0]?.processType || 'Machining')}
                                        </strong>
                                    </div>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                        Returnable DC
                                    </span>
                                </div>

                                {challan.estimatedPrice || (challan as any).totalJobWorkCharges ? (
                                    <div className="col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                                            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Declared Material Value</span>
                                            <strong className="text-slate-800 dark:text-slate-200 font-extrabold text-sm font-mono">
                                                ₹{Number(challan.estimatedPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </strong>
                                        </div>
                                        <div className="bg-indigo-50/70 dark:bg-indigo-950/40 p-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800">
                                            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 uppercase font-bold block">Total Job Work Charges</span>
                                            <strong className="text-indigo-700 dark:text-indigo-300 font-extrabold text-sm font-mono">
                                                ₹{Number((challan as any).totalJobWorkCharges || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </strong>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Items Details */}
                    {challan.operationMode === 'assembly' ? (
                        <div className="space-y-5">
                            {/* Dispatched Components Table */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                        <Layers size={14} className="text-amber-500" /> Dispatched Components / Bill of Materials (Kit Sent)
                                    </span>
                                    <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                                        {challan.items.length} Component{challan.items.length > 1 ? 's' : ''} Outwarded
                                    </span>
                                </div>

                                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-700">
                                            <tr>
                                                <th className="px-4 py-3">#</th>
                                                <th className="px-4 py-3">Component / Material Sent</th>
                                                <th className="px-4 py-3 text-center">Dispatched Qty</th>
                                                <th className="px-4 py-3">Process / Specifications</th>
                                                <th className="px-4 py-3 text-right">Estimated Rate / Value</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                            {challan.items.map((item, idx) => {
                                                const isSec = Boolean(item.hasSecondaryUnit && item.secondaryUnit && item.selectedUnit === item.secondaryUnit);
                                                const activeQty = isSec
                                                    ? (Number(item.secondaryQuantitySent) || (Number(item.quantitySent || 0) * Number(item.conversionFactor || 1)))
                                                    : Number(item.quantitySent || 0);
                                                const activeUnit = isSec ? item.secondaryUnit : (item.unit || 'PCS');
                                                const rate = Number(item.processRate != null ? item.processRate : item.unitPrice || 0);
                                                const lineVal = item.processAmount != null && Number(item.processAmount) > 0
                                                    ? Number(item.processAmount)
                                                    : (activeQty * rate);

                                                return (
                                                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                                                        <td className="px-4 py-3.5 text-xs text-slate-400 font-mono font-bold">{idx + 1}</td>
                                                        <td className="px-4 py-3.5">
                                                            <div className="font-bold text-slate-900 dark:text-white">{item.itemName}</div>
                                                            {item.description && (
                                                                <div className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-2">{item.description}</div>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3.5 text-center font-bold text-slate-800 dark:text-slate-200">
                                                            {activeQty} <span className="text-xs text-slate-400">{activeUnit}</span>
                                                        </td>
                                                        <td className="px-4 py-3.5 text-xs text-slate-600 dark:text-slate-300">
                                                            <span className="font-semibold text-slate-800 dark:text-slate-200">🎯 {item.processType || (challan.purpose === 'Others' && challan.otherPurpose ? challan.otherPurpose : (item.purpose || challan.purpose || 'Job Work'))}</span>
                                                            {item.itemType && (
                                                                <span className="ml-2 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-500 uppercase">{item.itemType}</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3.5 text-right text-xs">
                                                            {rate > 0 ? (
                                                                <>
                                                                    <div className="font-bold font-mono text-indigo-600 dark:text-indigo-400">
                                                                        ₹{rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {activeUnit}
                                                                    </div>
                                                                    <div className="text-[11px] text-slate-400 font-mono">
                                                                        ₹{lineVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                    </div>
                                                                </>
                                                            ) : (
                                                                <span className="text-slate-400">-</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Target Welded / Assembled Product Return Cards */}
                            {challan.operationMode === 'assembly' && (() => {
                                const groups = (challan.assemblyGroups && challan.assemblyGroups.length > 0)
                                    ? challan.assemblyGroups
                                    : (challan.assemblyOutputItem ? [{ groupName: 'Assembly Line Item #1', items: challan.items, assemblyOutputItem: challan.assemblyOutputItem }] : []);

                                if (groups.length === 0) return null;

                                return (
                                    <div className="space-y-4">
                                        {groups.map((grp, gIdx) => {
                                            const out = grp.assemblyOutputItem;
                                            if (!out) return null;
                                            const isOutSec = Boolean(out.hasSecondaryUnit && out.secondaryUnit && out.selectedUnit === out.secondaryUnit);
                                            const expectedQty = isOutSec
                                                ? (Number(out.secondaryQuantityToBeReceived) || (Number(out.quantityToBeReceived || 0) * Number(out.conversionFactor || 1)))
                                                : Number(out.quantityToBeReceived || 0);
                                            const outUnit = isOutSec ? out.secondaryUnit : (out.receivingUnit || 'PCS');
                                            const receivedQty = isOutSec
                                                ? Number(out.secondaryQuantityReceived || 0)
                                                : Number(out.quantityReceived || 0);
                                            const pendingQty = Math.max(0, expectedQty - receivedQty);

                                            return (
                                                <div key={gIdx} className="bg-gradient-to-br from-amber-500/10 via-indigo-500/5 to-slate-50 dark:to-slate-900 p-5 rounded-2xl border-2 border-amber-400/40 shadow-sm space-y-4">
                                                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/60 dark:border-amber-900/40 pb-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                                                                <Sparkles size={16} />
                                                            </div>
                                                            <div>
                                                                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                                                                    Inward Deliverable ({grp.groupName || `Set #${gIdx + 1}`})
                                                                </span>
                                                                <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                                                                    {out.itemName || 'Consolidated Assembly Product'}
                                                                </h4>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                                                                Destination: <strong className="text-indigo-600 dark:text-indigo-400">Shopfloor WIP FG</strong>
                                                            </span>
                                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                                                                out.status === 'Completed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                                                                receivedQty > 0 ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                                                                'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                                            }`}>
                                                                {out.status || 'Pending'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                                        <div className="sm:col-span-2 bg-white/80 dark:bg-slate-800/80 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-700">
                                                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Assembled Item Name</span>
                                                            <div className="font-extrabold text-slate-900 dark:text-white text-sm mt-0.5">
                                                                {out.itemName || 'Consolidated Assembly Product'}
                                                            </div>
                                                            {out.description && (
                                                                <div className="text-xs text-slate-500 italic mt-1 line-clamp-2">
                                                                    {out.description}
                                                                </div>
                                                            )}
                                                            {out.processType && (
                                                                <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold mt-1">
                                                                    Process: {out.processType}
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="bg-white/80 dark:bg-slate-800/80 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-700">
                                                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Expected Return Qty</span>
                                                            <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                                                                {expectedQty} <span className="text-xs font-semibold text-slate-400">{outUnit}</span>
                                                            </div>
                                                        </div>

                                                        <div className="bg-white/80 dark:bg-slate-800/80 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-700">
                                                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Received / Pending</span>
                                                            <div className="flex items-baseline gap-2 mt-0.5">
                                                                <span className="text-lg font-black text-emerald-600">
                                                                    {receivedQty}
                                                                </span>
                                                                <span className="text-xs text-slate-400">/</span>
                                                                <span className="text-sm font-black text-amber-600">
                                                                    {pendingQty} {outUnit}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <Package size={14} /> Items Sent & Expected Return Material Mapping
                                </span>
                            </div>

                            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-700">
                                        <tr>
                                            <th className="px-4 py-3">Item Sent</th>
                                            <th className="px-4 py-3 text-center">Sent Qty</th>
                                            <th className="px-4 py-3">Material to be Received</th>
                                            <th className="px-4 py-3 text-center">Exp. Return</th>
                                            <th className="px-4 py-3 text-center">Recv Qty</th>
                                            <th className="px-4 py-3 text-center">Pending</th>
                                            <th className="px-4 py-3 text-right">JW Rate</th>
                                            <th className="px-4 py-3 text-right">JW Amount</th>
                                            <th className="px-4 py-3">Process / Purpose</th>
                                            <th className="px-4 py-3 text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                        {challan.items.map((item, idx) => {
                                            const retList: JobWorkReturningItem[] = (item.returningItems && item.returningItems.length > 0)
                                                ? item.returningItems
                                                : [{
                                                    receivedItemName: item.receivedItemName || item.itemToBeReceived || item.itemName,
                                                    receivedItemType: item.receivedItemType || 'fg',
                                                    quantityToBeReceived: item.quantityToBeReceived || item.quantitySent,
                                                    quantityReceived: item.quantityReceived || 0,
                                                    receivingUnit: item.receivingUnit || item.unit || 'PCS',
                                                    hasSecondaryUnit: item.hasSecondaryUnit,
                                                    secondaryUnit: item.secondaryUnit,
                                                    conversionFactor: item.conversionFactor,
                                                    secondaryQuantityToBeReceived: item.secondaryQuantityToBeReceived,
                                                    secondaryQuantityReceived: item.secondaryQuantityReceived,
                                                    processRate: item.processRate || 0,
                                                    processAmount: item.processAmount || 0,
                                                    description: item.description,
                                                    status: item.status
                                                }];

                                            return retList.map((ret, rIdx) => {
                                                const isRetSec = Boolean(ret.hasSecondaryUnit && ret.secondaryUnit && ret.selectedUnit === ret.secondaryUnit);
                                                const expQty = isRetSec
                                                    ? (Number(ret.secondaryQuantityToBeReceived) || (Number(ret.quantityToBeReceived != null ? ret.quantityToBeReceived : item.quantitySent) * Number(ret.conversionFactor || 1)))
                                                    : Number(ret.quantityToBeReceived != null ? ret.quantityToBeReceived : item.quantitySent) || 0;
                                                const activeRetUnit = isRetSec ? ret.secondaryUnit : (ret.receivingUnit || ret.unit || 'PCS');
                                                const recvQty = isRetSec
                                                    ? Number(ret.secondaryQuantityReceived || 0)
                                                    : Number(ret.quantityReceived || 0);
                                                const pending = Math.max(0, expQty - recvQty);
                                                const retRate = Number(ret.processRate) || 0;
                                                const retAmount = ret.processAmount ? Number(ret.processAmount) : (retRate * expQty);

                                                const isItemSec = Boolean(item.hasSecondaryUnit && item.secondaryUnit && item.selectedUnit === item.secondaryUnit);
                                                const activeSentQty = isItemSec
                                                    ? (Number(item.secondaryQuantitySent) || (Number(item.quantitySent || 0) * Number(item.conversionFactor || 1)))
                                                    : Number(item.quantitySent || 0);
                                                const activeSentUnit = isItemSec ? item.secondaryUnit : (item.unit || 'PCS');

                                                return (
                                                    <tr key={`${idx}_${rIdx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                                                        {rIdx === 0 && (
                                                            <td rowSpan={retList.length} className="px-4 py-3.5 font-bold text-slate-900 dark:text-white border-r border-slate-100 dark:border-slate-800 align-top">
                                                                <div>{item.itemName}</div>
                                                                {item.description && (
                                                                    <div className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-2">{item.description}</div>
                                                                )}
                                                            </td>
                                                        )}

                                                        {rIdx === 0 && (
                                                            <td rowSpan={retList.length} className="px-4 py-3.5 text-center font-bold text-slate-700 dark:text-slate-300 border-r border-slate-100 dark:border-slate-800 align-top">
                                                                {activeSentQty} <span className="text-xs text-slate-400">{activeSentUnit}</span>
                                                            </td>
                                                        )}

                                                        <td className="px-4 py-3.5 font-bold text-indigo-700 dark:text-indigo-300">
                                                            <div className="flex items-center gap-1.5">
                                                                <ArrowRight size={14} className="text-indigo-500 flex-shrink-0" />
                                                                {ret.receivedItemName || item.itemName}
                                                            </div>
                                                            {ret.description && (
                                                                <div className="text-[11px] text-slate-500 italic mt-0.5 pl-5 line-clamp-2">{ret.description}</div>
                                                            )}
                                                        </td>

                                                        <td className="px-4 py-3.5 text-center font-bold text-slate-800 dark:text-slate-200">
                                                            {expQty} <span className="text-xs text-slate-400">{activeRetUnit}</span>
                                                        </td>

                                                        <td className="px-4 py-3.5 text-center font-bold text-emerald-600 dark:text-emerald-400">
                                                            {recvQty}
                                                        </td>

                                                        <td className="px-4 py-3.5 text-center font-black text-amber-600 dark:text-amber-400">
                                                            {pending > 0 ? pending : 0}
                                                        </td>

                                                        <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                                                            {retRate > 0 ? `₹${retRate.toFixed(2)}` : '-'}
                                                        </td>

                                                        <td className="px-4 py-3.5 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                                            {retAmount > 0 ? `₹${retAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                                                        </td>

                                                        {rIdx === 0 && (
                                                            <td rowSpan={retList.length} className="px-4 py-3.5 border-l border-slate-100 dark:border-slate-800 align-top text-xs">
                                                                <div className="font-bold text-slate-800 dark:text-slate-200">
                                                                    🎯 {item.purpose || item.processType || challan.purpose || 'Job Work'}
                                                                </div>
                                                                {item.unitPrice ? (
                                                                    <div className="text-[11px] text-slate-500 font-semibold font-mono mt-0.5">
                                                                        Mat Val: ₹{Number(item.unitPrice).toLocaleString()} / {item.unit || 'PCS'}
                                                                    </div>
                                                                ) : null}
                                                                {item.description ? <div className="text-slate-400 italic mt-0.5">{item.description}</div> : null}
                                                            </td>
                                                        )}

                                                        <td className="px-4 py-3.5 text-right">
                                                            {ret.status === 'Completed' || pending <= 0 ? (
                                                                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                                                                    <CheckCircle2 size={14} /> Completed
                                                                </span>
                                                            ) : (
                                                                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                                                                    {ret.status || 'Pending'}
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            });
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Section: Important Notes & Delivery Challan Conditions (Serial-Wise) */}
                    {(() => {
                        const noteItems = (challan.notes && Array.isArray(challan.notes) && challan.notes.filter(n => n && n.trim()).length > 0)
                            ? challan.notes.filter(n => n && n.trim())
                            : (challan.remarks ? [challan.remarks] : [
                                "Material sent on Returnable Delivery Challan for job-work processing only and not for sale.",
                                challan.expectedReturnDate 
                                    ? `Please arrange to return the material back to us on or before ${new Date(challan.expectedReturnDate).toLocaleDateString('en-GB')}.`
                                    : "Please process and return the finished items on or before the agreed expected delivery date.",
                                "Process scrap, turnings, and rejections (if any) must be accounted for and returned along with the processed goods.",
                                "Kindly quote our Delivery Challan number and date on all your return challans, delivery notes, and service invoices.",
                                "The subcontractor/consignee shall be held liable for any loss, damage, or shortage while the material is under custody."
                            ]);

                        return (
                            <div className="bg-slate-50 dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                                    <FileText size={15} className="text-indigo-500" /> Important Notes & Delivery Challan Conditions
                                </span>
                                <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                                    {noteItems.map((note, nIdx) => (
                                        <li key={nIdx} className="leading-relaxed">
                                            <span className="font-medium text-slate-800 dark:text-slate-200">{note}</span>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        );
                    })()}

                    {/* Receive History Timeline */}
                    {(challan as any).receiveHistory && (challan as any).receiveHistory.length > 0 && (
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                <Clock size={15} className="text-indigo-500" /> WIP Return GRN & QC Receipt History
                            </span>
                            <div className="space-y-2 pt-1">
                                {(challan as any).receiveHistory.map((hist: any, i: number) => {
                                    const matchedItem = challan.items.find((it: any) => String(it._id) === String(hist.itemId));
                                    const grnNo = hist.grnNumber || `GRN-${i + 1}`;
                                    const isQcPending = hist.qcStatus === 'Pending';
                                    const isQcPassed = hist.qcStatus === 'Passed';

                                    const remainingReturnSecs = getRemainingSeconds(hist.date || (hist as any).createdAt, 'jobWorkReturn');
                                    const isReturnActionable = isTimeLockExpired(hist.date || (hist as any).createdAt, 'jobWorkReturn') === false;

                                    // Extract photos from both hist.photos and image documents
                                    const receiptPhotos: string[] = [];
                                    if (Array.isArray(hist.photos)) {
                                        hist.photos.forEach((p: string) => { if (p && !receiptPhotos.includes(p)) receiptPhotos.push(p); });
                                    }
                                    if (Array.isArray(hist.documents)) {
                                        hist.documents.forEach((d: any) => {
                                            if ((d.fileType?.startsWith('image/') || d.url?.startsWith('data:image')) && !receiptPhotos.includes(d.url)) {
                                                receiptPhotos.push(d.url);
                                            }
                                        });
                                    }

                                    return (
                                        <div key={i} className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-xs font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                                                        {grnNo}
                                                    </span>
                                                    <span className="font-bold text-sm text-slate-800 dark:text-slate-200">
                                                        {hist.quantity} units ({hist.itemName || matchedItem?.itemName || 'Material'})
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2 flex-wrap">
                                                    {hist.qcRequired && (
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                                                            isQcPassed ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                                                            isQcPending ? 'bg-amber-100 text-amber-800 border-amber-200' :
                                                            'bg-red-100 text-red-800 border-red-200'
                                                        }`}>
                                                            QC: {hist.qcStatus || 'Passed'}
                                                        </span>
                                                    )}
                                                    <span className="text-xs text-slate-400 font-mono">{new Date(hist.date).toLocaleString('en-GB')}</span>

                                                    {/* Inward Return Edit / Delete Time-Lock Governance */}
                                                    {isReturnActionable ? (
                                                        <div className="flex items-center gap-1.5 ml-1 bg-amber-50/80 dark:bg-amber-950/40 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800">
                                                            <span className="text-[10px] font-mono font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1" title="Time window remaining to amend or delete this return record">
                                                                <Clock size={11} className="text-amber-600 animate-pulse" />
                                                                <span>{formatRemainingTime(remainingReturnSecs)}</span>
                                                            </span>
                                                            <span className="text-amber-300">|</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditingReceipt(hist)}
                                                                className="p-1 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900 rounded transition-colors"
                                                                title="Edit return document details & attachments"
                                                            >
                                                                <Edit3 size={12} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={async () => {
                                                                    const confirmed = await showDestructiveConfirm({
                                                                        title: "Delete Return Receipt",
                                                                        text: `Are you sure you want to delete return receipt ${grnNo}? Inward quantities and stock counters will be safely rolled back.`,
                                                                        confirmButtonText: "Yes, Delete & Rollback"
                                                                    });
                                                                    if (!confirmed) return;
                                                                    try {
                                                                        await apiDelete(`/api/store/jobwork/receive/${challan._id}/${hist._id}`, token!);
                                                                        showSuccessToast("Return receipt deleted and stock rolled back successfully");
                                                                        if (onRefresh) onRefresh();
                                                                        onClose();
                                                                    } catch (err: any) {
                                                                        console.error(err);
                                                                        showErrorDialog("Delete Failed", err.message || "Failed to delete return receipt");
                                                                    }
                                                                }}
                                                                className="p-1 text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900 rounded transition-colors"
                                                                title="Delete and rollback inward receipt"
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 border border-slate-200 dark:border-slate-700 flex items-center gap-1" title={`Edit/Delete window expired (${getPolicyHours('jobWorkReturn')}h limit)`}>
                                                            <Lock size={10} /> Locked ({getPolicyHours('jobWorkReturn')}h)
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Extra GRN Metadata */}
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-500 pt-1">
                                                {(hist.customerDcNumber || hist.vendorDcNumber) && (
                                                    <div>
                                                        DC: <strong className="text-slate-700 dark:text-slate-300 font-mono">#{hist.customerDcNumber || hist.vendorDcNumber}</strong>
                                                        {hist.vendorInvoiceDate && <span className="text-[10px] text-slate-400 ml-1">({new Date(hist.vendorInvoiceDate).toLocaleDateString('en-GB')})</span>}
                                                    </div>
                                                )}
                                                {hist.invoiceNumber && (
                                                    <div>
                                                        Invoice: <strong className="text-slate-700 dark:text-slate-300 font-mono">#{hist.invoiceNumber}</strong>
                                                        {hist.invoiceDate && <span className="text-[10px] text-slate-400 ml-1">({new Date(hist.invoiceDate).toLocaleDateString('en-GB')})</span>}
                                                    </div>
                                                )}
                                                {hist.vehicleNo && <div>Vehicle: <strong className="text-slate-700 dark:text-slate-300">{hist.vehicleNo}</strong></div>}
                                                <div>Accepted: <strong className="text-emerald-600">{hist.acceptedQuantity !== undefined ? hist.acceptedQuantity : hist.quantity}</strong></div>
                                                {hist.rejectedQuantity > 0 && <div>Rejected: <strong className="text-red-600">{hist.rejectedQuantity}</strong> ({hist.rejectionReason || 'Defect'})</div>}
                                                {hist.rate ? (
                                                    <div className="col-span-2 sm:col-span-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                                        JW Charges: @ ₹{Number(hist.rate).toFixed(2)} = ₹{Number(hist.amount || (hist.quantity * hist.rate)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </div>
                                                ) : null}
                                            </div>

                                            {/* Attached Documents & PDF */}
                                            {((hist.pdfDocument && hist.pdfDocument.url) || (Array.isArray(hist.documents) && hist.documents.length > 0)) && (
                                                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                                                    {hist.pdfDocument?.url && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setPreviewPdfModal({ url: hist.pdfDocument.url, filename: hist.pdfDocument.filename || 'Return_Document.pdf' })}
                                                            className="text-[11px] font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-800/80 inline-flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                                                        >
                                                            <FileText size={13} className="text-rose-600" />
                                                            <span>📄 View PDF: {hist.pdfDocument.filename || 'Document'}</span>
                                                        </button>
                                                    )}
                                                    {Array.isArray(hist.documents) && hist.documents
                                                        .filter((doc: any) => !hist.pdfDocument || doc.url !== hist.pdfDocument.url)
                                                        .filter((doc: any) => !doc.fileType?.startsWith('image/') && !doc.url?.startsWith('data:image'))
                                                        .map((doc: any, dIdx: number) => (
                                                            <button
                                                                key={dIdx}
                                                                type="button"
                                                                onClick={() => {
                                                                    if (doc.url.toLowerCase().includes('.pdf') || doc.fileType === 'application/pdf' || doc.url.startsWith('data:application/pdf')) {
                                                                        setPreviewPdfModal({ url: doc.url, filename: doc.filename || 'Document.pdf' });
                                                                    } else {
                                                                        openSafeUrlInNewTab(doc.url);
                                                                    }
                                                                }}
                                                                className="text-[11px] font-bold text-indigo-600 hover:underline bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-800 inline-flex items-center gap-1 cursor-pointer"
                                                            >
                                                                📎 {doc.filename || 'Attachment'}
                                                            </button>
                                                        ))}
                                                </div>
                                            )}

                                            {/* Received Goods Photos Gallery */}
                                            {receiptPhotos.length > 0 && (
                                                <div className="pt-1">
                                                    <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                                                        <Camera size={12} className="text-teal-600" />
                                                        <span>Received Goods Photos ({receiptPhotos.length})</span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {receiptPhotos.map((photoUrl: string, pIdx: number) => (
                                                            <div 
                                                                key={pIdx}
                                                                onClick={() => setPreviewPhoto(photoUrl)}
                                                                className="w-16 h-16 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden cursor-pointer hover:ring-2 hover:ring-teal-500 transition-all bg-slate-100 dark:bg-slate-800 shrink-0 group relative shadow-2xs"
                                                                title="Click to view full image"
                                                            >
                                                                <img src={photoUrl} alt="Received Item" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                                                <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                                                                    <Eye size={13} />
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Buttons */}
                <div className="p-5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        {onEdit && challan.status !== 'Closed' && (
                            <button
                                onClick={() => { onClose(); onEdit(challan); }}
                                className="px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-100 transition-colors flex items-center gap-1.5"
                            >
                                <Edit3 size={15} /> Edit Challan
                            </button>
                        )}
                        {onDelete && challan.status !== 'Closed' && (
                            <button
                                onClick={() => { onClose(); onDelete(challan._id); }}
                                className="px-4 py-2.5 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-xl font-semibold text-xs hover:bg-red-100 transition-colors flex items-center gap-1.5"
                            >
                                <Trash2 size={15} /> Delete
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                        <button
                            onClick={handleDownloadPDF}
                            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2"
                        >
                            <FileText size={16} /> Print / Export 3-Copy PDF
                        </button>

                        <button
                            onClick={handleDownloadExcel}
                            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2"
                        >
                            <FileSpreadsheet size={16} /> Excel
                        </button>

                        {onReceive && challan.status !== 'Closed' && (
                            <button
                                onClick={() => { onClose(); onReceive(challan); }}
                                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2"
                            >
                                <Truck size={16} /> Mark Received
                            </button>
                        )}
                    </div>
                </div>

            </div>

            {/* Photo Lightbox */}
            {previewPhoto && (
                <div 
                    className="fixed inset-0 z-[270] flex items-center justify-center p-3 bg-black/90 backdrop-blur-sm"
                    onClick={() => setPreviewPhoto(null)}
                >
                    <div className="relative max-w-3xl max-h-[85vh] p-2" onClick={(e) => e.stopPropagation()}>
                        <img src={previewPhoto} alt="Received Item Preview" className="max-w-full max-h-[80vh] rounded-2xl object-contain" />
                        <button
                            onClick={() => setPreviewPhoto(null)}
                            className="absolute top-3 right-3 p-1.5 bg-black/80 text-white rounded-full hover:bg-black"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* In-Modal PDF Viewer Dialog */}
            {previewPdfModal && (
                <div 
                    className="fixed inset-0 z-[270] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm"
                    onClick={() => setPreviewPdfModal(null)}
                >
                    <div 
                        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-3.5 bg-slate-950 text-white flex justify-between items-center flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <FileText size={18} className="text-rose-400" />
                                <span className="font-bold text-sm truncate">{previewPdfModal.filename}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => downloadDataUrl(previewPdfModal.url, previewPdfModal.filename)}
                                    className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-200 transition-colors"
                                    title="Download PDF"
                                >
                                    <Download size={15} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => openSafeUrlInNewTab(previewPdfModal.url)}
                                    className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-200 transition-colors"
                                    title="Open in new tab"
                                >
                                    <ExternalLink size={15} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPreviewPdfModal(null)}
                                    className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-200 transition-colors"
                                >
                                    <X size={15} />
                                </button>
                            </div>
                        </div>
                        <div className="p-2 flex-1 h-[75vh]">
                            <iframe 
                                src={getSafeBlobUrl(previewPdfModal.url)} 
                                className="w-full h-full rounded-xl border-0 bg-slate-100 dark:bg-slate-800" 
                                title="PDF Preview" 
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Return Receipt Modal */}
            {editingReceipt && (
                <EditJobWorkReturnModal
                    isOpen={Boolean(editingReceipt)}
                    onClose={() => setEditingReceipt(null)}
                    onSuccess={() => {
                        setEditingReceipt(null);
                        showSuccessToast("Return receipt updated successfully");
                        if (onRefresh) onRefresh();
                        onClose();
                    }}
                    onError={(msg) => showErrorDialog("Update Failed", msg)}
                    challanId={challan._id}
                    receipt={editingReceipt}
                    token={token || null}
                />
            )}

        </div>
    );
}

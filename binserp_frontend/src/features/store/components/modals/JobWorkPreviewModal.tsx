import React from 'react';
import { X, Calendar, User, Truck, Package, Layers, FileText, FileSpreadsheet, Check, CheckCircle2, Factory, Clock, ArrowRight, ShieldCheck, Edit3, Trash2 } from 'lucide-react';
import { JobWorkChallan, Vendor } from "@/src/features/store/types/store.types";
import { generateDocument } from '@/src/utils/documentHelper';

interface JobWorkPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    challan: JobWorkChallan | null;
    vendors?: Vendor[];
    jobWorkSuppliers?: any[];
    companyInfo?: any;
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
    onEdit,
    onReceive,
    onDelete
}: JobWorkPreviewModalProps) {
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

                                {challan.estimatedPrice ? (
                                    <div className="col-span-2 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Estimated Material Job Value</span>
                                        <strong className="text-indigo-600 dark:text-indigo-400 font-extrabold text-sm">₹{Number(challan.estimatedPrice).toLocaleString()}</strong>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Items Details Table */}
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
                                        <th className="px-4 py-3">Process / Rate</th>
                                        <th className="px-4 py-3 text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                    {challan.items.map((item, idx) => {
                                        const retList = (item.returningItems && item.returningItems.length > 0)
                                            ? item.returningItems
                                            : [{
                                                receivedItemName: item.receivedItemName || item.itemToBeReceived || item.itemName,
                                                quantityToBeReceived: item.quantityToBeReceived || item.quantitySent,
                                                quantityReceived: item.quantityReceived || 0,
                                                receivingUnit: item.receivingUnit || item.unit || 'PCS',
                                                status: item.status
                                            }];

                                        return retList.map((ret, rIdx) => {
                                            const expQty = Number(ret.quantityToBeReceived) || 0;
                                            const recvQty = Number(ret.quantityReceived) || 0;
                                            const pending = expQty - recvQty;

                                            return (
                                                <tr key={`${idx}_${rIdx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                                                    {rIdx === 0 && (
                                                        <td rowSpan={retList.length} className="px-4 py-3.5 font-bold text-slate-900 dark:text-white border-r border-slate-100 dark:border-slate-800 align-top">
                                                            {item.itemName}
                                                        </td>
                                                    )}

                                                    {rIdx === 0 && (
                                                        <td rowSpan={retList.length} className="px-4 py-3.5 text-center font-bold text-slate-700 dark:text-slate-300 border-r border-slate-100 dark:border-slate-800 align-top">
                                                            {item.quantitySent} <span className="text-xs text-slate-400">{item.unit}</span>
                                                        </td>
                                                    )}

                                                    <td className="px-4 py-3.5 font-bold text-indigo-700 dark:text-indigo-300">
                                                        <div className="flex items-center gap-1.5">
                                                            <ArrowRight size={14} className="text-indigo-500 flex-shrink-0" />
                                                            {ret.receivedItemName || item.itemName}
                                                        </div>
                                                    </td>

                                                    <td className="px-4 py-3.5 text-center font-bold text-slate-800 dark:text-slate-200">
                                                        {expQty} <span className="text-xs text-slate-400">{ret.receivingUnit || 'PCS'}</span>
                                                    </td>

                                                    <td className="px-4 py-3.5 text-center font-bold text-emerald-600 dark:text-emerald-400">
                                                        {recvQty}
                                                    </td>

                                                    <td className="px-4 py-3.5 text-center font-black text-amber-600 dark:text-amber-400">
                                                        {pending > 0 ? pending : 0}
                                                    </td>

                                                    {rIdx === 0 && (
                                                        <td rowSpan={retList.length} className="px-4 py-3.5 border-l border-slate-100 dark:border-slate-800 align-top text-xs">
                                                            <div className="font-bold text-slate-800 dark:text-slate-200">{item.processType || 'Job Work'}</div>
                                                            {(item.processRate || item.unitPrice) ? (
                                                                <div className="text-indigo-600 dark:text-indigo-400 font-bold font-mono mt-0.5">
                                                                    Rate: ₹{Number(item.processRate != null ? item.processRate : item.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {item.unit || 'PCS'}
                                                                </div>
                                                            ) : null}
                                                            {(item.processRate || item.unitPrice) ? (
                                                                <div className="text-[11px] text-slate-500 font-semibold font-mono">
                                                                    Value: ₹{(Number(item.quantitySent || 0) * Number(item.processRate != null ? item.processRate : item.unitPrice || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                                    const isQcRejected = hist.qcStatus === 'Rejected';

                                    return (
                                        <div key={i} className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-xs font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                                                        {grnNo}
                                                    </span>
                                                    <span className="font-bold text-sm text-slate-800 dark:text-slate-200">
                                                        {hist.quantity} units ({hist.itemName || matchedItem?.itemName || 'Material'})
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    {hist.qcRequired && (
                                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                                                            isQcPassed ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                                                            isQcPending ? 'bg-amber-100 text-amber-800 border-amber-200' :
                                                            'bg-red-100 text-red-800 border-red-200'
                                                        }`}>
                                                            QC: {hist.qcStatus || 'Passed'}
                                                        </span>
                                                    )}
                                                    <span className="text-xs text-slate-400 font-mono">{new Date(hist.date).toLocaleString('en-GB')}</span>
                                                </div>
                                            </div>

                                            {/* Extra GRN Metadata */}
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
                                                {hist.vendorDcNumber && <div>Vendor DC: <strong className="text-slate-700 dark:text-slate-300">{hist.vendorDcNumber}</strong></div>}
                                                {hist.vehicleNo && <div>Vehicle: <strong className="text-slate-700 dark:text-slate-300">{hist.vehicleNo}</strong></div>}
                                                <div>Accepted: <strong className="text-emerald-600">{hist.acceptedQuantity !== undefined ? hist.acceptedQuantity : hist.quantity}</strong></div>
                                                {hist.rejectedQuantity > 0 && <div>Rejected: <strong className="text-red-600">{hist.rejectedQuantity}</strong> ({hist.rejectionReason || 'Defect'})</div>}
                                            </div>

                                            {/* Attached Documents */}
                                            {Array.isArray(hist.documents) && hist.documents.length > 0 && (
                                                <div className="flex flex-wrap gap-2 pt-1">
                                                    {hist.documents.map((doc: any, dIdx: number) => (
                                                        <a
                                                            key={dIdx}
                                                            href={doc.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-[11px] font-bold text-indigo-600 hover:underline bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-800 inline-flex items-center gap-1"
                                                        >
                                                            📎 {doc.filename || 'Attachment'}
                                                        </a>
                                                    ))}
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
                        {onEdit && challan.status !== 'Partial' && challan.status !== 'Closed' && (
                            <button
                                onClick={() => { onClose(); onEdit(challan); }}
                                className="px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-100 transition-colors flex items-center gap-1.5"
                            >
                                <Edit3 size={15} /> Edit Challan
                            </button>
                        )}
                        {onDelete && challan.status !== 'Partial' && challan.status !== 'Closed' && (
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
        </div>
    );
}

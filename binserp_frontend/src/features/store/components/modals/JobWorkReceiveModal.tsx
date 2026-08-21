import React, { useState, useEffect } from 'react';
import { X, Check, ArrowRight, Truck, FileText, ShieldCheck, ShieldAlert, Upload, Paperclip, AlertCircle, Calendar, Factory, Package } from 'lucide-react';
import { JobWorkChallan } from "@/src/features/store/types/store.types";
import { apiPut } from '@/src/lib/api';

interface JobWorkReceiveModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    onError: (msg: string) => void;
    challan: JobWorkChallan;
    token: string | null;
}

export default function JobWorkReceiveModal({ isOpen, onClose, onSuccess, onError, challan, token }: JobWorkReceiveModalProps) {
    const [loading, setLoading] = useState(false);

    // Logistics & Header State
    const [grnNumber, setGrnNumber] = useState('');
    const [vendorDcNumber, setVendorDcNumber] = useState('');
    const [vendorInvoiceDate, setVendorInvoiceDate] = useState('');
    const [vehicleNo, setVehicleNo] = useState('');
    const [qcRequired, setQcRequired] = useState(true);
    const [qcStatus, setQcStatus] = useState<'Pending' | 'Passed' | 'Rejected' | 'Partial'>('Pending');
    const [remarks, setRemarks] = useState('');
    const [documentFiles, setDocumentFiles] = useState<{ filename: string; fileType: string; url: string }[]>([]);

    // Item Receipt Data State
    const [receiveData, setReceiveData] = useState<{
        itemId: string;
        returningItemId?: string;
        quantity: number;
        acceptedQuantity: number;
        rejectedQuantity: number;
        reworkQuantity: number;
        rejectionReason: string;
        batchNumber: string;
    }[]>([]);

    const generateGrnNo = () => {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        return `JWGRN-${dateStr}-${randomNum}`;
    };

    useEffect(() => {
        if (isOpen) {
            setGrnNumber(generateGrnNo());
            setVendorDcNumber('');
            setVendorInvoiceDate(new Date().toISOString().slice(0, 10));
            setVehicleNo('');
            setQcRequired(true);
            setQcStatus('Pending');
            setRemarks('');
            setDocumentFiles([]);
            setReceiveData([]);
        }
    }, [isOpen]);

    const handleItemChange = (
        itemId: string, 
        returningItemId: string | undefined, 
        field: string, 
        value: any
    ) => {
        const existingIdx = receiveData.findIndex(d => (returningItemId ? d.returningItemId === returningItemId : d.itemId === itemId));
        
        if (existingIdx >= 0) {
            const updated = [...receiveData];
            const currentItem = { ...updated[existingIdx], [field]: value };
            
            // Auto-calculate Accepted Qty if Received Qty changed and no rejected entered yet
            if (field === 'quantity') {
                const qtyNum = Number(value) || 0;
                currentItem.acceptedQuantity = Math.max(0, qtyNum - (currentItem.rejectedQuantity || 0));
            }
            if (field === 'rejectedQuantity') {
                const rejNum = Number(value) || 0;
                currentItem.acceptedQuantity = Math.max(0, (currentItem.quantity || 0) - rejNum);
            }

            updated[existingIdx] = currentItem;
            setReceiveData(updated);
        } else {
            const newItem = {
                itemId,
                returningItemId,
                quantity: field === 'quantity' ? Number(value) || 0 : 0,
                acceptedQuantity: field === 'quantity' ? Number(value) || 0 : 0,
                rejectedQuantity: field === 'rejectedQuantity' ? Number(value) || 0 : 0,
                reworkQuantity: field === 'reworkQuantity' ? Number(value) || 0 : 0,
                rejectionReason: field === 'rejectionReason' ? value : '',
                batchNumber: field === 'batchNumber' ? value : ''
            };
            setReceiveData([...receiveData, newItem]);
        }
    };

    const getItemData = (itemId: string, returningItemId?: string) => {
        return receiveData.find(d => (returningItemId ? d.returningItemId === returningItemId : d.itemId === itemId)) || {
            itemId,
            returningItemId,
            quantity: 0,
            acceptedQuantity: 0,
            rejectedQuantity: 0,
            reworkQuantity: 0,
            rejectionReason: '',
            batchNumber: ''
        };
    };

    const handleFillAllPending = () => {
        const fullList: any[] = [];
        
        challan.items.forEach(sentItem => {
            const parentId = sentItem._id || sentItem.item || '';
            if (Array.isArray(sentItem.returningItems) && sentItem.returningItems.length > 0) {
                sentItem.returningItems.forEach(ret => {
                    const retId = ret._id || '';
                    const pending = Number(ret.quantityToBeReceived) - Number(ret.quantityReceived || 0);
                    const qty = pending > 0 ? pending : 0;
                    fullList.push({
                        itemId: parentId,
                        returningItemId: retId,
                        quantity: qty,
                        acceptedQuantity: qty,
                        rejectedQuantity: 0,
                        reworkQuantity: 0,
                        rejectionReason: '',
                        batchNumber: ''
                    });
                });
            } else {
                const target = Number(sentItem.quantityToBeReceived || sentItem.quantitySent) || 0;
                const pending = target - Number(sentItem.quantityReceived || 0);
                const qty = pending > 0 ? pending : 0;
                fullList.push({
                    itemId: parentId,
                    quantity: qty,
                    acceptedQuantity: qty,
                    rejectedQuantity: 0,
                    reworkQuantity: 0,
                    rejectionReason: '',
                    batchNumber: ''
                });
            }
        });

        setReceiveData(fullList);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const newDocs = Array.from(files).map(file => ({
            filename: file.name,
            fileType: file.type || 'document',
            url: URL.createObjectURL(file) // Demonstrative attachment preview link
        }));

        setDocumentFiles(prev => [...prev, ...newDocs]);
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const itemsToReceive = receiveData.filter(d => d.quantity > 0);

            if (itemsToReceive.length === 0) {
                onError('Please enter received quantity for at least one returning material');
                setLoading(false);
                return;
            }

            const payload = {
                grnNumber,
                vendorDcNumber,
                vendorInvoiceDate,
                vehicleNo,
                qcRequired,
                qcStatus: qcRequired ? 'Pending' : 'Passed',
                remarks,
                documents: documentFiles,
                items: itemsToReceive
            };

            await apiPut(`/api/store/jobwork/receive/${challan._id}`, payload, token);
            onSuccess();
        } catch (error: any) {
            onError(error.message || "Failed to log WIP Return GRN");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-6xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]">
                
                {/* Modal Header */}
                <div className="p-6 bg-indigo-950 text-white flex justify-between items-center flex-shrink-0 border-b border-indigo-900">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-900 rounded-xl flex items-center justify-center border border-indigo-700">
                            <Truck size={20} className="text-indigo-300" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-extrabold tracking-tight">WIP Return GRN & Quality Receipt</h2>
                                <span className="bg-indigo-800/80 text-indigo-200 border border-indigo-700 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold">
                                    {grnNumber}
                                </span>
                            </div>
                            <p className="text-xs text-indigo-300/80 mt-0.5">
                                Job Work Challan: <span className="font-mono font-bold text-white">{challan.challanNumber}</span> | Subcontractor: <span className="font-semibold text-white">{challan.vendor?.name || 'Supplier'}</span>
                            </p>
                        </div>
                    </div>

                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-indigo-900 hover:bg-indigo-800 flex items-center justify-center text-white transition-colors border border-indigo-700">
                        <X size={18} />
                    </button>
                </div>

                {/* Content Body */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    
                    {/* Workflow Mode & Stock Rule Banner */}
                    {challan.jobWorkType === 'route-card' ? (
                        <div className="bg-purple-50 dark:bg-purple-950/40 p-3.5 rounded-2xl border border-purple-200 dark:border-purple-800/60 flex items-start gap-3">
                            <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 shrink-0">
                                <Factory size={18} />
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-purple-900 dark:text-purple-200">
                                    PPC Shopfloor WIP Subcontracting
                                </h4>
                                <p className="text-xs text-purple-700 dark:text-purple-300/80 mt-0.5">
                                    This return moves goods back to the <strong>Shopfloor Production Line (Active WIP)</strong> and advances the PPC Route Card operation sequence to <em>Completed</em>. It <strong>does NOT increase store inventory stock</strong> (FG stock will be created when production is completed via FG GRN).
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-blue-50 dark:bg-blue-950/40 p-3.5 rounded-2xl border border-blue-200 dark:border-blue-800/60 flex items-start gap-3">
                            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 shrink-0">
                                <Package size={18} />
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-blue-900 dark:text-blue-200">
                                    Store Inventory Conversion
                                </h4>
                                <p className="text-xs text-blue-700 dark:text-blue-300/80 mt-0.5">
                                    This return will <strong>increase stock in Store Inventory</strong> for the specified converted RM / BO or Finished Goods.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Section 1: Logistics & Subcontractor Delivery Info */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                        <h3 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                            <FileText size={15} className="text-indigo-500" /> Subcontractor Delivery & Logistics Information
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                    Vendor DC / Invoice No
                                </label>
                                <input
                                    type="text"
                                    value={vendorDcNumber}
                                    onChange={(e) => setVendorDcNumber(e.target.value)}
                                    placeholder="e.g. DC-9982"
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                    Vendor Invoice Date
                                </label>
                                <input
                                    type="date"
                                    value={vendorInvoiceDate}
                                    onChange={(e) => setVendorInvoiceDate(e.target.value)}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                    Vehicle / Transporter No
                                </label>
                                <input
                                    type="text"
                                    value={vehicleNo}
                                    onChange={(e) => setVehicleNo(e.target.value)}
                                    placeholder="e.g. MH-12-AB-1234"
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                    QC Inspection Check
                                </label>
                                <div 
                                    onClick={() => setQcRequired(!qcRequired)}
                                    className={`cursor-pointer px-3 py-2 rounded-xl border flex items-center justify-between text-xs font-bold transition-all ${
                                        qcRequired 
                                            ? 'bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300' 
                                            : 'bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    }`}
                                >
                                    <span className="flex items-center gap-1.5">
                                        {qcRequired ? <ShieldAlert size={16} className="text-amber-600" /> : <ShieldCheck size={16} className="text-emerald-600" />}
                                        {qcRequired ? 'QC Inspection Required' : 'Direct Stock Accept'}
                                    </span>
                                    <input type="checkbox" checked={qcRequired} onChange={() => {}} className="accent-indigo-600" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Items Table with QC & Defect Breakup */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                Returned Items Receipt & Defect Breakdown
                            </h3>
                            <button
                                type="button"
                                onClick={handleFillAllPending}
                                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800"
                            >
                                Receive All Pending Quantities
                            </button>
                        </div>

                        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs text-left min-w-[900px]">
                                    <thead className="bg-slate-100 dark:bg-slate-800/80 font-bold text-slate-600 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-700">
                                        <tr>
                                            <th className="px-4 py-3">Sent Material</th>
                                            <th className="px-4 py-3">Expected Return Material</th>
                                            <th className="px-4 py-3 text-center">Exp Qty</th>
                                            <th className="px-4 py-3 text-center">Pending</th>
                                            <th className="px-4 py-3 text-center w-28">Received Qty</th>
                                            <th className="px-4 py-3 text-center w-24">Accepted</th>
                                            <th className="px-4 py-3 text-center w-24">Rejected</th>
                                            <th className="px-4 py-3 text-left">Rejection Reason</th>
                                            <th className="px-4 py-3 text-left w-28">Batch / Heat No</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                        {challan.items.map((sentItem, sentIdx) => {
                                            const parentId = sentItem._id || sentItem.item || `${sentIdx}`;
                                            const retList = Array.isArray(sentItem.returningItems) && sentItem.returningItems.length > 0
                                                ? sentItem.returningItems
                                                : [{
                                                    _id: parentId,
                                                    receivedItemName: sentItem.receivedItemName || sentItem.itemToBeReceived || sentItem.itemName,
                                                    receivedItemType: sentItem.receivedItemType || 'fg',
                                                    quantityToBeReceived: Number(sentItem.quantityToBeReceived || sentItem.quantitySent) || 0,
                                                    quantityReceived: Number(sentItem.quantityReceived) || 0,
                                                    receivingUnit: sentItem.receivingUnit || sentItem.unit || 'PCS'
                                                }];

                                            return retList.map((ret, retIdx) => {
                                                const expectedQty = Number(ret.quantityToBeReceived) || 0;
                                                const receivedQty = Number(ret.quantityReceived) || 0;
                                                const pendingQty = expectedQty - receivedQty;
                                                const isDone = ret.status === 'Completed' || pendingQty <= 0;

                                                const itemData = getItemData(parentId, ret._id);

                                                return (
                                                    <tr key={`${sentIdx}_${retIdx}`} className={isDone ? "opacity-50 bg-slate-50/50 dark:bg-slate-900/50" : ""}>
                                                        {retIdx === 0 ? (
                                                            <td rowSpan={retList.length} className="px-4 py-3 font-bold text-slate-900 dark:text-white border-r border-slate-100 dark:border-slate-800 align-top bg-slate-50/30 dark:bg-slate-900/30">
                                                                {sentItem.itemName}
                                                                <span className="block text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5">
                                                                    Sent: {sentItem.quantitySent} {sentItem.unit}
                                                                </span>
                                                            </td>
                                                        ) : null}

                                                        <td className="px-4 py-3 font-bold text-indigo-700 dark:text-indigo-300">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <ArrowRight size={13} className="text-indigo-500 flex-shrink-0" />
                                                                <span>{ret.receivedItemName || sentItem.itemName}</span>
                                                                <span className={`px-1.5 py-0.5 text-[9px] font-extrabold rounded ${
                                                                    ((ret.receivedItemType as string) === 'bo' || (ret.receivedItemType as string) === 'rm')
                                                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/50'
                                                                        : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/50'
                                                                }`}>
                                                                    {((ret.receivedItemType as string) === 'bo' || (ret.receivedItemType as string) === 'rm') ? 'RM/BO Stock' : 'FG Stock'}
                                                                </span>

                                                            </div>
                                                        </td>


                                                        <td className="px-4 py-3 text-center font-semibold text-slate-700 dark:text-slate-300">
                                                            {expectedQty} <span className="text-[10px] text-slate-400">{ret.receivingUnit || 'PCS'}</span>
                                                        </td>

                                                        <td className="px-4 py-3 text-center font-extrabold text-indigo-600 dark:text-indigo-400">
                                                            {pendingQty > 0 ? pendingQty : 0}
                                                        </td>

                                                        {/* Received Qty */}
                                                        <td className="px-3 py-2">
                                                            {isDone ? (
                                                                <span className="text-xs font-bold text-slate-400 block text-center">Done</span>
                                                            ) : (
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    max={pendingQty}
                                                                    step="any"
                                                                    value={itemData.quantity || ''}
                                                                    onChange={(e) => handleItemChange(parentId, ret._id, 'quantity', e.target.value)}
                                                                    placeholder="0"
                                                                    className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white text-center focus:ring-2 focus:ring-indigo-500/20"
                                                                />
                                                            )}
                                                        </td>

                                                        {/* Accepted Qty */}
                                                        <td className="px-3 py-2">
                                                            {!isDone && (
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    step="any"
                                                                    value={itemData.acceptedQuantity || ''}
                                                                    onChange={(e) => handleItemChange(parentId, ret._id, 'acceptedQuantity', e.target.value)}
                                                                    placeholder="0"
                                                                    className="w-full px-2 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 rounded-lg font-bold text-emerald-700 dark:text-emerald-300 text-center"
                                                                />
                                                            )}
                                                        </td>

                                                        {/* Rejected Qty */}
                                                        <td className="px-3 py-2">
                                                            {!isDone && (
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    step="any"
                                                                    value={itemData.rejectedQuantity || ''}
                                                                    onChange={(e) => handleItemChange(parentId, ret._id, 'rejectedQuantity', e.target.value)}
                                                                    placeholder="0"
                                                                    className="w-full px-2 py-1.5 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-700 rounded-lg font-bold text-red-700 dark:text-red-300 text-center"
                                                                />
                                                            )}
                                                        </td>

                                                        {/* Rejection Reason */}
                                                        <td className="px-3 py-2">
                                                            {!isDone && (
                                                                <select
                                                                    value={itemData.rejectionReason}
                                                                    onChange={(e) => handleItemChange(parentId, ret._id, 'rejectionReason', e.target.value)}
                                                                    className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                                                                >
                                                                    <option value="">No Defect</option>
                                                                    <option value="Dimension Out of Spec">Dimension Out of Spec</option>
                                                                    <option value="Surface Rust / Scratch">Surface Rust / Scratch</option>
                                                                    <option value="Plating / Coating Flaw">Plating / Coating Flaw</option>
                                                                    <option value="Incomplete Machining">Incomplete Machining</option>
                                                                    <option value="Material Cracks / Porosity">Material Cracks / Porosity</option>
                                                                    <option value="Other">Other Reason</option>
                                                                </select>
                                                            )}
                                                        </td>

                                                        {/* Batch Number */}
                                                        <td className="px-3 py-2">
                                                            {!isDone && (
                                                                <input
                                                                    type="text"
                                                                    value={itemData.batchNumber}
                                                                    onChange={(e) => handleItemChange(parentId, ret._id, 'batchNumber', e.target.value)}
                                                                    placeholder="Heat/Batch"
                                                                    className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                                                                />
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
                    </div>

                    {/* Section 3: Document Attachments & Inspector Remarks */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        {/* Attachments */}
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                            <label className="block text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Paperclip size={15} className="text-indigo-500" /> Subcontractor Documents & Inspection Photos
                            </label>
                            
                            <div className="flex items-center gap-3">
                                <label className="cursor-pointer px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-950 dark:border-indigo-800 dark:text-indigo-300 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors">
                                    <Upload size={15} /> Upload Documents
                                    <input type="file" multiple onChange={handleFileUpload} className="hidden" />
                                </label>
                                <span className="text-xs text-slate-400">Vendor DC, Test Reports, Photos</span>
                            </div>

                            {documentFiles.length > 0 && (
                                <div className="space-y-1.5 mt-2">
                                    {documentFiles.map((doc, idx) => (
                                        <div key={idx} className="flex items-center justify-between text-xs bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                                            <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[250px]">{doc.filename}</span>
                                            <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded">Attached</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Inspection Remarks */}
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                            <label className="block text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                QC Inspection & Inspector Remarks
                            </label>
                            <textarea
                                rows={3}
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                placeholder="Enter any notes regarding incoming material quality, packing condition, or vendor issues..."
                                className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>

                    </div>

                </div>

                {/* Footer Buttons */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-100 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || receiveData.filter(d => d.quantity > 0).length === 0}
                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50 flex items-center gap-2"
                    >
                        <Check size={18} />
                        {loading ? 'Generating WIP GRN...' : 'Submit WIP Return GRN & QC'}
                    </button>
                </div>

            </div>
        </div>
    );
}

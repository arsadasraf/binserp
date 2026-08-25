import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Check, ArrowRight, Truck, ShieldCheck, 
  ShieldAlert, Camera, Image as ImageIcon, Eye, 
  Sparkles, Plus, Minus, Package
} from 'lucide-react';
import { JobWorkChallan } from "@/src/features/store/types/store.types";
import { apiPut } from '@/src/lib/api';
import { compressImage } from '@/src/utils/imageCompressor';

interface JobWorkReceiveModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    onError: (msg: string) => void;
    challan: JobWorkChallan;
    token: string | null;
}

interface AttachedPhoto {
    id: string;
    filename: string;
    url: string;
    sizeKb: number;
}

export default function JobWorkReceiveModal({ isOpen, onClose, onSuccess, onError, challan, token }: JobWorkReceiveModalProps) {
    const [loading, setLoading] = useState(false);
    const [isCompressing, setIsCompressing] = useState(false);

    // Logistics State
    const [grnNumber, setGrnNumber] = useState('');
    const [vendorDcNumber, setVendorDcNumber] = useState('');
    const [vendorInvoiceDate, setVendorInvoiceDate] = useState('');
    const [vehicleNo, setVehicleNo] = useState('');
    const [qcRequired, setQcRequired] = useState(true);
    const [remarks, setRemarks] = useState('');

    // Document & Delivery Photos (Up to 5)
    const [photos, setPhotos] = useState<AttachedPhoto[]>([]);
    const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

    // Hidden File Input Refs
    const galleryInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    // Item Receipt Data State
    const [receiveData, setReceiveData] = useState<{
        itemId: string;
        returningItemId?: string;
        quantity: number;
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
            setRemarks('');
            setPhotos([]);
            setPreviewPhoto(null);
            setReceiveData([]);
        }
    }, [isOpen]);

    // Handle Image Files with Client-Side Canvas Compression
    const handleFilesSelected = async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        const currentCount = photos.length;
        const availableSlots = 5 - currentCount;

        if (availableSlots <= 0) {
            alert('Maximum 5 document photos allowed.');
            return;
        }

        const filesToProcess = Array.from(files).slice(0, availableSlots);
        if (files.length > availableSlots) {
            alert(`Only ${availableSlots} more photo(s) can be attached (max limit: 5).`);
        }

        try {
            setIsCompressing(true);
            const newPhotos: AttachedPhoto[] = [];

            for (const file of filesToProcess) {
                if (!file.type.startsWith('image/')) continue;

                const compressedBase64 = await compressImage(file, {
                    maxWidth: 1280,
                    maxHeight: 1280,
                    quality: 0.8,
                    mimeType: 'image/jpeg'
                });

                const approxSizeKb = Math.round((compressedBase64.length * 3/4) / 1024);

                newPhotos.push({
                    id: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                    filename: file.name || `JW_Delivery_${Date.now()}.jpg`,
                    url: compressedBase64,
                    sizeKb: approxSizeKb
                });
            }

            setPhotos(prev => [...prev, ...newPhotos]);
        } catch (err) {
            console.error('Error compressing image:', err);
            alert('Failed to process image compression.');
        } finally {
            setIsCompressing(false);
            if (galleryInputRef.current) galleryInputRef.current.value = '';
            if (cameraInputRef.current) cameraInputRef.current.value = '';
        }
    };

    const handleRemovePhoto = (id: string) => {
        setPhotos(prev => prev.filter(p => p.id !== id));
    };

    const handleItemChange = (
        itemId: string, 
        returningItemId: string | undefined, 
        value: any
    ) => {
        const existingIdx = receiveData.findIndex(d => (returningItemId ? d.returningItemId === returningItemId : d.itemId === itemId));
        const qtyNum = Math.max(0, Number(value) || 0);
        
        if (existingIdx >= 0) {
            const updated = [...receiveData];
            updated[existingIdx] = { ...updated[existingIdx], quantity: qtyNum };
            setReceiveData(updated);
        } else {
            setReceiveData([...receiveData, {
                itemId,
                returningItemId,
                quantity: qtyNum
            }]);
        }
    };

    const getItemQuantity = (itemId: string, returningItemId?: string) => {
        const item = receiveData.find(d => (returningItemId ? d.returningItemId === returningItemId : d.itemId === itemId));
        return item ? item.quantity : 0;
    };

    const handleFillAllPending = () => {
        const fullList: any[] = [];
        
        challan.items.forEach(sentItem => {
            const parentId = sentItem._id || sentItem.item || '';
            if (Array.isArray(sentItem.returningItems) && sentItem.returningItems.length > 0) {
                sentItem.returningItems.forEach(ret => {
                    const retId = ret._id || '';
                    const expectedQty = Number(ret.quantityToBeReceived) || 0;
                    const receivedQty = Number(ret.quantityReceived) || 0;
                    const pendingQty = Math.max(0, expectedQty - receivedQty);

                    if (pendingQty > 0) {
                        fullList.push({
                            itemId: parentId,
                            returningItemId: retId,
                            quantity: pendingQty
                        });
                    }
                });
            } else {
                const expectedQty = Number(sentItem.quantityToBeReceived || sentItem.quantitySent) || 0;
                const receivedQty = Number(sentItem.quantityReceived) || 0;
                const pendingQty = Math.max(0, expectedQty - receivedQty);

                if (pendingQty > 0) {
                    fullList.push({
                        itemId: parentId,
                        quantity: pendingQty
                    });
                }
            }
        });

        setReceiveData(fullList);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const activeItems = receiveData.filter(d => d.quantity > 0);
        if (activeItems.length === 0) {
            onError('Please enter received quantity for at least one item');
            return;
        }

        try {
            setLoading(true);

            const payload = {
                grnNumber,
                vendorDcNumber,
                vendorInvoiceDate: vendorInvoiceDate ? new Date(vendorInvoiceDate) : undefined,
                vehicleNo,
                qcRequired,
                remarks,
                documents: photos.map(p => ({
                    filename: p.filename,
                    fileType: 'image/jpeg',
                    url: p.url
                })),
                photos: photos.map(p => p.url),
                items: activeItems.map(d => ({
                    itemId: d.itemId,
                    returningItemId: d.returningItemId,
                    quantity: d.quantity
                }))
            };

            await apiPut(`/api/store/jobwork/receive/${challan._id}`, payload, token!);
            onSuccess();
        } catch (err: any) {
            console.error(err);
            onError(err.message || 'Failed to process Job Work Inward receipt');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const totalReceivedCount = receiveData.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[94vh]">
                
                {/* Hidden Inputs */}
                <input
                    type="file"
                    ref={galleryInputRef}
                    onChange={(e) => handleFilesSelected(e.target.files)}
                    multiple
                    accept="image/*"
                    className="hidden"
                />
                <input
                    type="file"
                    ref={cameraInputRef}
                    onChange={(e) => handleFilesSelected(e.target.files)}
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                />

                {/* Header */}
                <div className="p-4 sm:p-5 bg-slate-950 text-white flex justify-between items-center flex-shrink-0 border-b border-slate-800">
                    <div className="flex items-center gap-2.5 sm:gap-3">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 bg-teal-950 text-teal-400 rounded-xl flex items-center justify-center border border-teal-800 flex-shrink-0">
                            <Truck size={18} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-base sm:text-lg font-black tracking-tight">Receive Job Work Return</h2>
                                <span className="bg-teal-950 text-teal-300 border border-teal-800/80 px-2 py-0.5 rounded-md text-[11px] font-mono font-bold">
                                    {grnNumber}
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-400">
                                Challan: <span className="font-mono text-white font-bold">{challan.challanNumber}</span> • {challan.vendor?.name || 'Subcontractor'}
                            </p>
                        </div>
                    </div>

                    <button 
                        onClick={onClose} 
                        className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Body Form */}
                <form onSubmit={handleSubmit} className="p-3.5 sm:p-5 overflow-y-auto flex-1 space-y-4 text-xs sm:text-sm">
                    
                    {/* Section 1: Logistics Compact Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 mb-1">Vendor DC Ref</label>
                            <input
                                type="text"
                                value={vendorDcNumber}
                                onChange={(e) => setVendorDcNumber(e.target.value)}
                                placeholder="e.g. DC-102"
                                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 mb-1">DC Date</label>
                            <input
                                type="date"
                                value={vendorInvoiceDate}
                                onChange={(e) => setVendorInvoiceDate(e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 mb-1">Vehicle No</label>
                            <input
                                type="text"
                                value={vehicleNo}
                                onChange={(e) => setVehicleNo(e.target.value)}
                                placeholder="e.g. MH-12-1234"
                                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 mb-1">QC Routing</label>
                            <div 
                                onClick={() => setQcRequired(!qcRequired)}
                                className={`cursor-pointer px-2.5 py-1.5 rounded-xl border flex items-center justify-between text-xs font-bold transition-all ${
                                    qcRequired 
                                        ? 'bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300' 
                                        : 'bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300'
                                }`}
                            >
                                <span className="flex items-center gap-1 truncate text-[11px]">
                                    {qcRequired ? <ShieldAlert size={14} className="text-amber-600 shrink-0" /> : <ShieldCheck size={14} className="text-emerald-600 shrink-0" />}
                                    <span>{qcRequired ? 'QC Required' : 'Direct Stock'}</span>
                                </span>
                                <input type="checkbox" checked={qcRequired} onChange={() => {}} className="accent-teal-600 ml-1" />
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Items To Receive */}
                    <div className="space-y-2.5">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                Items to Receive
                            </span>
                            <button
                                type="button"
                                onClick={handleFillAllPending}
                                className="text-[11px] font-bold text-teal-600 dark:text-teal-400 hover:underline bg-teal-50 dark:bg-teal-950 px-2.5 py-1 rounded-lg border border-teal-200 dark:border-teal-800"
                            >
                                Receive All Pending
                            </button>
                        </div>

                        {/* MOBILE VIEW (< 768px): Touch-Friendly Item Cards */}
                        <div className="md:hidden space-y-2.5">
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
                                    const alreadyReceived = Number(ret.quantityReceived) || 0;
                                    const pendingQty = Math.max(0, expectedQty - alreadyReceived);
                                    const isDone = ret.status === 'Completed' || pendingQty <= 0;
                                    const enteredQty = getItemQuantity(parentId, ret._id);

                                    return (
                                        <div 
                                            key={`${sentIdx}_${retIdx}`}
                                            className={`p-3.5 rounded-2xl border ${
                                                isDone 
                                                    ? 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-60' 
                                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xs'
                                            } space-y-3`}
                                        >
                                            {/* Item Names */}
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <div className="text-[11px] font-semibold text-slate-400">
                                                        Sent: <b className="text-slate-700 dark:text-slate-200">{sentItem.itemName}</b> ({sentItem.quantitySent} {sentItem.unit})
                                                    </div>
                                                    <div className="font-bold text-sm text-slate-900 dark:text-white mt-0.5 flex items-center gap-1">
                                                        <ArrowRight size={13} className="text-teal-500 shrink-0" />
                                                        <span>{ret.receivedItemName || sentItem.itemName}</span>
                                                    </div>
                                                </div>
                                                <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-extrabold rounded">
                                                    {(ret.receivedItemType || 'fg').toUpperCase()}
                                                </span>
                                            </div>

                                            {/* Quantities Badges & Stepper */}
                                            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                                                    <span>Expected: <b>{expectedQty}</b></span>
                                                    <span>•</span>
                                                    <span>Pending: <b className="text-teal-600">{pendingQty}</b></span>
                                                </div>

                                                {isDone ? (
                                                    <span className="px-2 py-1 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 text-xs font-bold rounded-lg">
                                                        Completed
                                                    </span>
                                                ) : (
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleItemChange(parentId, ret._id, Math.max(0, enteredQty - 1))}
                                                            className="w-7 h-7 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-lg flex items-center justify-center font-bold"
                                                        >
                                                            <Minus size={13} />
                                                        </button>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max={pendingQty}
                                                            step="any"
                                                            value={enteredQty || ''}
                                                            onChange={(e) => handleItemChange(parentId, ret._id, e.target.value)}
                                                            placeholder="0"
                                                            className="w-16 px-1.5 py-1 bg-white dark:bg-slate-800 border border-teal-300 dark:border-teal-700 rounded-lg font-bold text-center text-xs"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleItemChange(parentId, ret._id, Math.min(pendingQty, enteredQty + 1))}
                                                            className="w-7 h-7 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-lg flex items-center justify-center font-bold"
                                                        >
                                                            <Plus size={13} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                });
                            })}
                        </div>

                        {/* DESKTOP VIEW (≥ 768px): Clean Compact Table */}
                        <div className="hidden md:block border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-100 dark:bg-slate-800/80 font-bold text-slate-600 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        <th className="px-4 py-2.5">Sent Material</th>
                                        <th className="px-4 py-2.5">Expected Return Item</th>
                                        <th className="px-3 py-2.5 text-center">Expected</th>
                                        <th className="px-3 py-2.5 text-center">Received</th>
                                        <th className="px-3 py-2.5 text-center">Pending</th>
                                        <th className="px-4 py-2.5 text-center w-32">Received Qty</th>
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
                                            const alreadyReceived = Number(ret.quantityReceived) || 0;
                                            const pendingQty = Math.max(0, expectedQty - alreadyReceived);
                                            const isDone = ret.status === 'Completed' || pendingQty <= 0;
                                            const enteredQty = getItemQuantity(parentId, ret._id);

                                            return (
                                                <tr key={`${sentIdx}_${retIdx}`} className={isDone ? "opacity-50 bg-slate-50/50" : "hover:bg-slate-50/40"}>
                                                    {retIdx === 0 ? (
                                                        <td rowSpan={retList.length} className="px-4 py-3 font-bold text-slate-900 dark:text-white border-r border-slate-100 dark:border-slate-800 align-top bg-slate-50/20">
                                                            {sentItem.itemName}
                                                            <span className="block text-[10px] font-semibold text-teal-600 mt-0.5">
                                                                Sent: {sentItem.quantitySent} {sentItem.unit}
                                                            </span>
                                                        </td>
                                                    ) : null}

                                                    <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <ArrowRight size={13} className="text-teal-500 shrink-0" />
                                                            <span>{ret.receivedItemName || sentItem.itemName}</span>
                                                            <span className="px-1.5 py-0.5 text-[9px] font-extrabold rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                                                {(ret.receivedItemType || 'fg').toUpperCase()}
                                                            </span>
                                                        </div>
                                                    </td>

                                                    <td className="px-3 py-3 text-center font-semibold">{expectedQty}</td>
                                                    <td className="px-3 py-3 text-center font-semibold text-slate-400">{alreadyReceived}</td>
                                                    <td className="px-3 py-3 text-center font-extrabold text-teal-600">{pendingQty}</td>

                                                    <td className="px-3 py-2">
                                                        {isDone ? (
                                                            <span className="text-xs font-bold text-emerald-600 block text-center bg-emerald-50 dark:bg-emerald-950 py-1 rounded-lg">
                                                                Done
                                                            </span>
                                                        ) : (
                                                            <div className="flex items-center gap-1">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    max={pendingQty}
                                                                    step="any"
                                                                    value={enteredQty || ''}
                                                                    onChange={(e) => handleItemChange(parentId, ret._id, e.target.value)}
                                                                    placeholder="0"
                                                                    className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-teal-300 dark:border-teal-700 rounded-lg font-bold text-slate-900 dark:text-white text-center focus:ring-2 focus:ring-teal-500/20"
                                                                />
                                                                <span className="text-[10px] text-slate-400 font-bold">
                                                                    {ret.receivingUnit || 'PCS'}
                                                                </span>
                                                            </div>
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

                    {/* Section 3: Delivery Photos Toolbar */}
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                <Camera size={14} className="text-teal-600" />
                                <span>Photos ({photos.length}/5)</span>
                            </div>

                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    disabled={photos.length >= 5 || isCompressing}
                                    onClick={() => cameraInputRef.current?.click()}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 disabled:opacity-50"
                                >
                                    <Camera size={13} className="text-teal-600" />
                                    <span>Camera</span>
                                </button>

                                <button
                                    type="button"
                                    disabled={photos.length >= 5 || isCompressing}
                                    onClick={() => galleryInputRef.current?.click()}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 disabled:opacity-50"
                                >
                                    <ImageIcon size={13} className="text-indigo-600" />
                                    <span>Gallery</span>
                                </button>
                            </div>
                        </div>

                        {isCompressing && (
                            <div className="flex items-center gap-2 p-2 bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 rounded-xl text-[11px] font-semibold animate-pulse">
                                <Sparkles size={13} className="animate-spin" />
                                <span>⚡ Compressing image on device...</span>
                            </div>
                        )}

                        {photos.length > 0 && (
                            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 pt-1">
                                {photos.map((photo) => (
                                    <div 
                                        key={photo.id} 
                                        className="relative group bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden aspect-square flex flex-col justify-between"
                                    >
                                        <img src={photo.url} alt={photo.filename} className="w-full h-full object-cover" />

                                        <div className="absolute top-1 right-1 flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => setPreviewPhoto(photo.url)}
                                                className="p-1 bg-black/70 text-white rounded-full"
                                            >
                                                <Eye size={10} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleRemovePhoto(photo.id)}
                                                className="p-1 bg-red-600 text-white rounded-full"
                                            >
                                                <X size={10} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Section 4: Remarks */}
                    <div>
                        <input
                            type="text"
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            placeholder="Optional delivery remarks..."
                            className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                        />
                    </div>

                    {/* Footer */}
                    <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                        <div className="text-xs font-semibold text-slate-500">
                            Total: <b className="text-slate-900 dark:text-white font-bold">{totalReceivedCount} units</b>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
                                disabled={loading || totalReceivedCount === 0 || isCompressing}
                                className="flex items-center gap-1.5 px-5 py-1.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-500/20 disabled:opacity-50 transition-all"
                            >
                                <Check size={14} />
                                <span>{loading ? "Receiving..." : (qcRequired ? "Receive & Send QC" : "Receive Stock")}</span>
                            </button>
                        </div>
                    </div>
                </form>
            </div>

            {/* Photo Lightbox */}
            {previewPhoto && (
                <div 
                    className="fixed inset-0 z-[250] flex items-center justify-center p-3 bg-black/90 backdrop-blur-sm"
                    onClick={() => setPreviewPhoto(null)}
                >
                    <div className="relative max-w-3xl max-h-[85vh] p-2" onClick={(e) => e.stopPropagation()}>
                        <img src={previewPhoto} alt="Preview" className="max-w-full max-h-[80vh] rounded-2xl object-contain" />
                        <button
                            onClick={() => setPreviewPhoto(null)}
                            className="absolute top-3 right-3 p-1.5 bg-black/80 text-white rounded-full"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

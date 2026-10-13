import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Check, FileText, Upload, Trash2, ExternalLink, 
  Camera, Image as ImageIcon, Eye, Sparkles, Download 
} from 'lucide-react';
import { apiPut } from '@/src/lib/api';
import { compressImage } from '@/src/utils/imageCompressor';
import { showWarningToast, showErrorDialog } from '@/src/features/store/utils/storeDialogHelper';
import { getSafeBlobUrl, openSafeUrlInNewTab, downloadDataUrl } from '@/src/utils/dataUrlHelper';

interface EditJobWorkReturnModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    onError: (msg: string) => void;
    challanId: string;
    receipt: any;
    token: string | null;
}

interface AttachedPhoto {
    id: string;
    filename: string;
    url: string;
    sizeKb: number;
}

export default function EditJobWorkReturnModal({
    isOpen,
    onClose,
    onSuccess,
    onError,
    challanId,
    receipt,
    token
}: EditJobWorkReturnModalProps) {
    const [loading, setLoading] = useState(false);
    const [isCompressing, setIsCompressing] = useState(false);

    // Document State
    const [returnDocType, setReturnDocType] = useState<'dc' | 'invoice' | 'both'>('dc');
    const [customerDcNumber, setCustomerDcNumber] = useState('');
    const [customerDcDate, setCustomerDcDate] = useState('');
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [invoiceDate, setInvoiceDate] = useState('');
    const [vehicleNo, setVehicleNo] = useState('');
    const [remarks, setRemarks] = useState('');

    // PDF Document State
    const [pdfDocument, setPdfDocument] = useState<{
        url: string;
        filename: string;
        sizeKb: number;
    } | null>(null);
    const pdfInputRef = useRef<HTMLInputElement>(null);

    // Photos State
    const [photos, setPhotos] = useState<AttachedPhoto[]>([]);
    const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
    const [previewPdfModal, setPreviewPdfModal] = useState<{ url: string; filename: string } | null>(null);

    const galleryInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen && receipt) {
            setReturnDocType(receipt.returnDocType || (receipt.invoiceNumber && !receipt.customerDcNumber && !receipt.vendorDcNumber ? 'invoice' : 'dc'));
            setCustomerDcNumber(receipt.customerDcNumber || receipt.vendorDcNumber || '');
            setCustomerDcDate(receipt.vendorInvoiceDate ? new Date(receipt.vendorInvoiceDate).toISOString().slice(0, 10) : '');
            setInvoiceNumber(receipt.invoiceNumber || '');
            setInvoiceDate(receipt.invoiceDate ? new Date(receipt.invoiceDate).toISOString().slice(0, 10) : '');
            setVehicleNo(receipt.vehicleNo || '');
            setRemarks(receipt.remarks || '');
            
            if (receipt.pdfDocument && receipt.pdfDocument.url) {
                setPdfDocument({
                    url: receipt.pdfDocument.url,
                    filename: receipt.pdfDocument.filename || 'return_document.pdf',
                    sizeKb: Number(receipt.pdfDocument.sizeKb) || 0
                });
            } else {
                setPdfDocument(null);
            }

            // Populate existing photos
            const initialPhotos: AttachedPhoto[] = [];
            if (Array.isArray(receipt.photos)) {
                receipt.photos.forEach((url: string, pIdx: number) => {
                    initialPhotos.push({
                        id: `photo_${pIdx}_${Date.now()}`,
                        filename: `Photo #${pIdx + 1}`,
                        url,
                        sizeKb: 0
                    });
                });
            }
            if (Array.isArray(receipt.documents)) {
                receipt.documents.forEach((doc: any, dIdx: number) => {
                    if (doc.fileType?.startsWith('image/') || (doc.url && doc.url.startsWith('data:image'))) {
                        if (!initialPhotos.some(p => p.url === doc.url)) {
                            initialPhotos.push({
                                id: `doc_img_${dIdx}_${Date.now()}`,
                                filename: doc.filename || `Photo #${dIdx + 1}`,
                                url: doc.url,
                                sizeKb: 0
                            });
                        }
                    }
                });
            }
            setPhotos(initialPhotos);
            setPreviewPhoto(null);
            setPreviewPdfModal(null);
        }
    }, [isOpen, receipt]);

    const handlePdfSelected = (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const file = files[0];

        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            showWarningToast('Please upload a valid PDF document.');
            return;
        }

        const sizeKb = Math.round(file.size / 1024);
        if (sizeKb > 10 * 1024) {
            showWarningToast('PDF size cannot exceed 10 MB.');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            setPdfDocument({
                url: result,
                filename: file.name || `Return_Doc_${Date.now()}.pdf`,
                sizeKb
            });
        };
        reader.onerror = () => {
            showWarningToast('Failed to read the selected PDF file.');
        };
        reader.readAsDataURL(file);
    };

    const handleRemovePdf = () => {
        setPdfDocument(null);
        if (pdfInputRef.current) {
            pdfInputRef.current.value = '';
        }
    };

    const handleFilesSelected = async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        const currentCount = photos.length;
        const availableSlots = 5 - currentCount;

        if (availableSlots <= 0) {
            showWarningToast('Maximum 5 document photos allowed.');
            return;
        }

        const filesToProcess = Array.from(files).slice(0, availableSlots);
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
            await showErrorDialog('Compression Error', 'Failed to process image compression.');
        } finally {
            setIsCompressing(false);
            if (galleryInputRef.current) galleryInputRef.current.value = '';
            if (cameraInputRef.current) cameraInputRef.current.value = '';
        }
    };

    const handleRemovePhoto = (id: string) => {
        setPhotos(prev => prev.filter(p => p.id !== id));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if ((returnDocType === 'dc' || returnDocType === 'both') && !customerDcNumber.trim()) {
            onError('Please enter Delivery Challan (DC) Number');
            return;
        }
        if ((returnDocType === 'invoice' || returnDocType === 'both') && !invoiceNumber.trim()) {
            onError('Please enter Invoice Number');
            return;
        }

        try {
            setLoading(true);

            const documentList: any[] = photos.map(p => ({
                filename: p.filename,
                fileType: 'image/jpeg',
                url: p.url
            }));

            if (pdfDocument) {
                documentList.unshift({
                    filename: pdfDocument.filename,
                    fileType: 'application/pdf',
                    url: pdfDocument.url
                });
            }

            const payload = {
                returnDocType,
                customerDcNumber: customerDcNumber.trim(),
                vendorDcNumber: customerDcNumber.trim(),
                vendorInvoiceDate: customerDcDate ? new Date(customerDcDate) : undefined,
                invoiceNumber: invoiceNumber.trim(),
                invoiceDate: invoiceDate ? new Date(invoiceDate) : undefined,
                pdfDocument: pdfDocument ? {
                    url: pdfDocument.url,
                    filename: pdfDocument.filename,
                    fileType: 'application/pdf',
                    sizeKb: pdfDocument.sizeKb
                } : undefined,
                vehicleNo,
                remarks,
                documents: documentList,
                photos: photos.map(p => p.url)
            };

            await apiPut(`/api/store/jobwork/receive/${challanId}/${receipt._id}`, payload, token!);
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error(err);
            onError(err.message || 'Failed to update return receipt');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !receipt) return null;

    return (
        <div className="fixed inset-0 z-[220] flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]">
                
                {/* Hidden File Inputs */}
                <input
                    type="file"
                    ref={pdfInputRef}
                    onChange={(e) => handlePdfSelected(e.target.files)}
                    accept="application/pdf,.pdf"
                    className="hidden"
                />
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
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-base sm:text-lg font-black tracking-tight">Edit Return Receipt</h2>
                            <span className="bg-teal-950 text-teal-300 border border-teal-800/80 px-2 py-0.5 rounded-md text-[11px] font-mono font-bold">
                                {receipt.grnNumber || 'GRN'}
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                            Item: <span className="text-white font-bold">{receipt.itemName || 'Returned Item'}</span> • Qty: <span className="text-emerald-400 font-bold">{receipt.quantity}</span>
                        </p>
                    </div>

                    <button 
                        onClick={onClose} 
                        className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Body Form */}
                <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 text-xs sm:text-sm">
                    
                    {/* Document Selector */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-200 dark:border-slate-800">
                        <div>
                            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                Document Type
                            </label>
                            <p className="text-[10px] text-slate-400">
                                Select Return Delivery Challan, Tax Invoice, or Both
                            </p>
                        </div>

                        <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 self-start sm:self-auto">
                            <button
                                type="button"
                                onClick={() => setReturnDocType('dc')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                    returnDocType === 'dc'
                                        ? 'bg-teal-600 text-white shadow-xs'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                <span>📄 DC</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setReturnDocType('invoice')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                    returnDocType === 'invoice'
                                        ? 'bg-teal-600 text-white shadow-xs'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                <span>🧾 Invoice</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setReturnDocType('both')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                    returnDocType === 'both'
                                        ? 'bg-teal-600 text-white shadow-xs'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                <span>📑 Both</span>
                            </button>
                        </div>
                    </div>

                    {/* Dynamic Fields Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {(returnDocType === 'dc' || returnDocType === 'both') && (
                            <>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                                        Delivery Challan (DC) No *
                                    </label>
                                    <input
                                        type="text"
                                        value={customerDcNumber}
                                        onChange={(e) => setCustomerDcNumber(e.target.value)}
                                        placeholder="e.g. DC-102"
                                        required={returnDocType === 'dc'}
                                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-teal-500/20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                                        DC Date
                                    </label>
                                    <input
                                        type="date"
                                        value={customerDcDate}
                                        onChange={(e) => setCustomerDcDate(e.target.value)}
                                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-teal-500/20"
                                    />
                                </div>
                            </>
                        )}

                        {(returnDocType === 'invoice' || returnDocType === 'both') && (
                            <>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                                        Invoice Number *
                                    </label>
                                    <input
                                        type="text"
                                        value={invoiceNumber}
                                        onChange={(e) => setInvoiceNumber(e.target.value)}
                                        placeholder="e.g. INV-2024-451"
                                        required={returnDocType === 'invoice'}
                                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-teal-500/20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                                        Invoice Date
                                    </label>
                                    <input
                                        type="date"
                                        value={invoiceDate}
                                        onChange={(e) => setInvoiceDate(e.target.value)}
                                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-teal-500/20"
                                    />
                                </div>
                            </>
                        )}

                        <div className="sm:col-span-2">
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                                Vehicle No
                            </label>
                            <input
                                type="text"
                                value={vehicleNo}
                                onChange={(e) => setVehicleNo(e.target.value)}
                                placeholder="e.g. MH-12-1234"
                                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-teal-500/20"
                            />
                        </div>
                    </div>

                    {/* PDF Document Attachment */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <FileText size={15} className="text-rose-600" />
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Return Document PDF
                                </span>
                            </div>

                            {!pdfDocument ? (
                                <button
                                    type="button"
                                    onClick={() => pdfInputRef.current?.click()}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-900 hover:bg-slate-100 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-colors"
                                >
                                    <Upload size={12} className="text-rose-600" />
                                    <span>Upload PDF</span>
                                </button>
                            ) : null}
                        </div>

                        {pdfDocument && (
                            <div className="flex items-center justify-between p-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl">
                                <div className="flex items-center gap-2 truncate max-w-[280px]">
                                    <FileText size={15} className="text-rose-600 shrink-0" />
                                    <div className="truncate">
                                        <span className="text-xs font-bold text-rose-900 dark:text-rose-200 truncate block">
                                            {pdfDocument.filename}
                                        </span>
                                        {pdfDocument.sizeKb > 0 && (
                                            <span className="text-[10px] text-rose-600/80 dark:text-rose-400">
                                                {pdfDocument.sizeKb} KB
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setPreviewPdfModal(pdfDocument)}
                                        className="p-1 text-rose-700 hover:bg-rose-100 dark:hover:bg-rose-900 rounded-lg transition-colors"
                                        title="Preview PDF"
                                    >
                                        <Eye size={14} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleRemovePdf}
                                        className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-950 rounded-lg transition-colors"
                                        title="Remove PDF"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Photos Gallery Toolbar */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                                <Camera size={14} className="text-teal-600" />
                                <span>Photos ({photos.length}/5)</span>
                            </div>

                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    disabled={photos.length >= 5 || isCompressing}
                                    onClick={() => cameraInputRef.current?.click()}
                                    className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 disabled:opacity-50"
                                >
                                    <Camera size={12} className="text-teal-600" />
                                    <span>Camera</span>
                                </button>
                                <button
                                    type="button"
                                    disabled={photos.length >= 5 || isCompressing}
                                    onClick={() => galleryInputRef.current?.click()}
                                    className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 disabled:opacity-50"
                                >
                                    <ImageIcon size={12} className="text-indigo-600" />
                                    <span>Gallery</span>
                                </button>
                            </div>
                        </div>

                        {isCompressing && (
                            <div className="flex items-center gap-2 p-1.5 bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 rounded-lg text-[11px] font-semibold animate-pulse">
                                <Sparkles size={12} className="animate-spin" />
                                <span>⚡ Compressing image on device...</span>
                            </div>
                        )}

                        {photos.length > 0 && (
                            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 pt-1">
                                {photos.map((photo) => (
                                    <div 
                                        key={photo.id} 
                                        className="relative group bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden aspect-square"
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

                    {/* Remarks */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">Delivery Remarks</label>
                        <input
                            type="text"
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            placeholder="Optional return delivery remarks..."
                            className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                        />
                    </div>

                    {/* Footer */}
                    <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || isCompressing}
                            className="flex items-center gap-1.5 px-5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 transition-all shadow-md shadow-teal-500/20"
                        >
                            <Check size={14} />
                            <span>{loading ? "Saving..." : "Save Changes"}</span>
                        </button>
                    </div>
                </form>
            </div>

            {/* Photo Lightbox */}
            {previewPhoto && (
                <div 
                    className="fixed inset-0 z-[260] flex items-center justify-center p-3 bg-black/90 backdrop-blur-sm"
                    onClick={() => setPreviewPhoto(null)}
                >
                    <div className="relative max-w-3xl max-h-[85vh] p-2" onClick={(e) => e.stopPropagation()}>
                        <img src={previewPhoto} alt="Preview" className="max-w-full max-h-[80vh] rounded-2xl object-contain" />
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
                    className="fixed inset-0 z-[260] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm"
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
                                    onClick={() => downloadDataUrl(previewPdfModal.url, previewPdfModal.filename)}
                                    className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-200"
                                    title="Download PDF"
                                >
                                    <Download size={15} />
                                </button>
                                <button
                                    onClick={() => openSafeUrlInNewTab(previewPdfModal.url)}
                                    className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-200"
                                    title="Open in new window"
                                >
                                    <ExternalLink size={15} />
                                </button>
                                <button
                                    onClick={() => setPreviewPdfModal(null)}
                                    className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-200"
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
        </div>
    );
}

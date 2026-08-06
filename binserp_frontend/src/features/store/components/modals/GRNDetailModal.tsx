import React, { useState, useRef } from 'react';
import { X, Download, FileText, Camera, IndianRupee, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';

interface GRNDetailModalProps {
    grn: any;
    isOpen: boolean;
    onClose: () => void;
}

export default function GRNDetailModal({ grn, isOpen, onClose }: GRNDetailModalProps) {
    const [viewingPhotos, setViewingPhotos] = useState<string[] | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    if (!isOpen || !grn) return null;

    const totalAmount = grn.items?.reduce((sum: number, item: any) => {
        return sum + ((item.rate || 0) * (item.quantity || 0));
    }, 0) || 0;

    const scroll = (direction: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            const { current } = scrollContainerRef;
            const scrollAmount = current.clientWidth;
            current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
        }
    };

    const handleDownloadGRN = () => {
        // Create a printable version
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>GRN Details - ${grn.grnNumber}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
                    h1 { color: #4F46E5; border-bottom: 3px solid #4F46E5; padding-bottom: 10px; }
                    .header { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
                    .field { margin: 10px 0; }
                    .label { font-weight: bold; color: #666; }
                    .value { color: #000; margin-left: 10px; }
                    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                    th { background-color: #4F46E5; color: white; }
                    tr:nth-child(even) { background-color: #f9fafb; }
                    .total { text-align: right; font-size: 18px; font-weight: bold; color: #059669; margin-top: 20px; }
                    .footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; }
                    @media print { body { padding: 20px; } }
                </style>
            </head>
            <body>
                <h1>Goods Receipt Note</h1>
                
                <div class="header">
                    <div>
                        <div class="field"><span class="label">GRN Number:</span><span class="value">${grn.grnNumber}</span></div>
                        <div class="field"><span class="label">Date:</span><span class="value">${new Date(grn.date).toLocaleDateString()}</span></div>
                        <div class="field"><span class="label">Supplier:</span><span class="value">${grn.supplierName || 'N/A'}</span></div>
                    </div>
                    <div>
                        <div class="field"><span class="label">QC Status:</span><span class="value">${grn.qcStatus || 'N/A'}</span></div>
                        ${grn.poReference ? `<div class="field"><span class="label">PO Reference:</span><span class="value">${grn.poReference}</span></div>` : ''}
                        <div class="field"><span class="label">Created:</span><span class="value">${new Date(grn.createdAt || grn.date).toLocaleString()}</span></div>
                    </div>
                </div>

                <h2>Materials</h2>
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Material Name</th>
                            <th>Rcv</th>
                            <th>Acc</th>
                            <th>Rej</th>
                            <th>Unit</th>
                            <th>Rate (₹)</th>
                            <th>Amount (₹)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${grn.items?.map((item: any, index: number) => `
                            <tr>
                                <td>${index + 1}</td>
                                <td>${item.materialName || 'N/A'}</td>
                                <td>${item.quantity || item.receivedQuantity || 0}</td>
                                <td>${item.acceptedQuantity || 0}</td>
                                <td>${item.rejectedQuantity || 0}</td>
                                <td>${item.unit || 'PCS'}</td>
                                <td>₹${(item.rate || 0).toFixed(2)}</td>
                                <td>₹${((item.rate || 0) * (item.quantity || 0)).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="total">
                    Total Amount: ₹${totalAmount.toFixed(2)}
                </div>

                <div class="footer">
                    Generated on ${new Date().toLocaleString()} | GRN Details
                </div>

                <script>
                    window.onload = function() {
                        window.print();
                    }
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-6 py-4 flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-bold">GRN Details</h2>
                            <p className="text-indigo-100 text-sm">{grn.grnNumber}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-indigo-500 rounded-lg transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {/* Basic Info Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <label className="text-xs font-semibold text-gray-500 uppercase">Date</label>
                                <p className="text-lg font-medium text-gray-900">{new Date(grn.date).toLocaleDateString()}</p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <label className="text-xs font-semibold text-gray-500 uppercase">Supplier</label>
                                <p className="text-lg font-medium text-gray-900">{grn.supplierName || 'N/A'}</p>
                            </div>
                            {grn.poReference && (
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">PO Reference</label>
                                    <p className="text-lg font-medium text-gray-900">{grn.poReference}</p>
                                </div>
                            )}
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <label className="text-xs font-semibold text-gray-500 uppercase">QC Status</label>
                                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${grn.qcStatus === 'Completed' ? 'bg-green-100 text-green-800' :
                                    grn.qcStatus === 'Pending' ? 'bg-orange-100 text-orange-800' :
                                        grn.qcStatus === 'Partial' ? 'bg-blue-100 text-blue-800' :
                                            'bg-gray-100 text-gray-800'
                                    }`}>
                                    {grn.qcStatus || 'N/A'}
                                </span>
                            </div>
                        </div>

                        {/* Files Section */}
                        {(grn.pdf || (grn.photos && grn.photos.length > 0)) && (
                            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                <h3 className="text-sm font-semibold text-blue-900 mb-3">Attached Files</h3>
                                <div className="flex flex-wrap gap-3">
                                    {grn.pdf && (
                                        <a
                                            href={grn.pdf}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                        >
                                            <FileText size={16} />
                                            <span className="text-sm font-medium">View PDF</span>
                                        </a>
                                    )}
                                    {grn.photos && grn.photos.length > 0 && (
                                        <button
                                            onClick={() => setViewingPhotos(grn.photos)}
                                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                        >
                                            <Camera size={16} />
                                            <span className="text-sm font-medium">View Photos ({grn.photos.length})</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Materials Section */}
                        <div className="mb-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Materials</h3>

                            {/* Desktop Table */}
                            <div className="hidden md:block overflow-x-auto border border-gray-200 rounded-lg">
                                <table className="w-full">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">#</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Material</th>
                                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Rcv</th>
                                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Acc</th>
                                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Rej</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Unit</th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Rate (₹)</th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Amount (₹)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {grn.items?.map((item: any, index: number) => (
                                            <tr key={index} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 text-sm text-gray-900">{index + 1}</td>
                                                <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.materialName || 'N/A'}</td>
                                                <td className="px-4 py-3 text-sm text-gray-900 text-center">{item.quantity || item.receivedQuantity || 0}</td>
                                                <td className="px-4 py-3 text-sm text-green-600 font-medium text-center">{item.acceptedQuantity || 0}</td>
                                                <td className="px-4 py-3 text-sm text-red-600 font-bold text-center">{item.rejectedQuantity > 0 ? item.rejectedQuantity : '-'}</td>
                                                <td className="px-4 py-3 text-sm text-gray-600">{item.unit || 'PCS'}</td>
                                                <td className="px-4 py-3 text-sm text-gray-900 text-right">₹{(item.rate || 0).toFixed(2)}</td>
                                                <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">₹{((item.rate || 0) * (item.quantity || 0)).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-green-50 border-t-2 border-green-200">
                                        <tr>
                                            <td colSpan={5} className="px-4 py-4 text-right text-base font-bold text-gray-900">
                                                Total Amount:
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2 text-lg font-bold text-green-700">
                                                    <IndianRupee size={20} />
                                                    <span>₹{totalAmount.toFixed(2)}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            {/* Mobile Card View */}
                            <div className="md:hidden space-y-4">
                                {grn.items?.map((item: any, index: number) => (
                                    <div key={index} className="bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-sm">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-2">
                                                <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2 py-0.5 rounded-full">#{index + 1}</span>
                                                <span className="font-bold text-gray-900">{item.materialName || 'N/A'}</span>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-y-2 text-sm">
                                            <div className="text-gray-500 text-center">Rcv<br /><span className="text-gray-900 font-medium">{item.quantity || 0}</span></div>
                                            <div className="text-gray-500 text-center">Acc<br /><span className="text-green-600 font-medium">{item.acceptedQuantity || 0}</span></div>
                                            <div className="text-gray-500 text-center">Rej<br /><span className="text-red-600 font-bold">{item.rejectedQuantity || 0}</span></div>

                                            {/* Rate and Amount on new lines within the grid or separate? Need to check layout.
                                                The original had Rate on the right.
                                                Let's keep Rate and Amount below the quantities.
                                             */}
                                            <div className="col-span-3 flex justify-between pt-2 border-t border-gray-100 mt-1">
                                                <span className="text-gray-500">Rate: <span className="text-gray-900 font-medium">₹{(item.rate || 0).toFixed(2)}</span></span>
                                                <span className="text-gray-500">Unit: <span className="text-gray-900 font-medium">{item.unit || 'PCS'}</span></span>
                                            </div>

                                            <div className="col-span-2 border-t border-gray-200 pt-2 mt-2 flex justify-between items-center bg-white p-2 rounded-lg">
                                                <span className="font-semibold text-gray-700">Amount</span>
                                                <div className="flex items-center gap-1 font-bold text-green-700">
                                                    <IndianRupee size={16} />
                                                    <span>₹{((item.rate || 0) * (item.quantity || 0)).toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <div className="bg-green-50 p-4 rounded-xl border border-green-200 flex justify-between items-center">
                                    <span className="font-bold text-gray-900">Total Amount</span>
                                    <div className="flex items-center gap-1 font-bold text-green-700 text-lg">
                                        <IndianRupee size={20} />
                                        <span>₹{totalAmount.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-between items-center">
                        <p className="text-sm text-gray-500 hidden md:block">
                            Created: {new Date(grn.createdAt || grn.date).toLocaleString()}
                        </p>
                        <div className="flex gap-3 w-full md:w-auto">
                            <button
                                onClick={onClose}
                                className="flex-1 md:flex-none px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                            >
                                Close
                            </button>
                            <button
                                onClick={handleDownloadGRN}
                                className="flex-1 md:flex-none px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium flex items-center justify-center gap-2"
                            >
                                <Download size={18} />
                                <span className="hidden md:inline">Download/Print</span>
                                <span className="md:hidden">Download</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Photo Viewer Overlay */}
            {viewingPhotos && (
                <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-200">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent absolute top-0 left-0 right-0 z-20">
                        <button
                            onClick={() => setViewingPhotos(null)}
                            className="flex items-center gap-2 text-white bg-white/20 backdrop-blur-md px-4 py-2 rounded-full hover:bg-white/30 transition-all active:scale-95"
                        >
                            <ArrowLeft className="w-5 h-5 shadow-sm" />
                            <span className="font-semibold text-sm">Back</span>
                        </button>
                        <span className="text-white/90 font-medium text-sm bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm border border-white/10">
                            / {viewingPhotos.length}
                        </span>
                    </div>

                    {/* Snap Carousel */}
                    <div className="flex-1 relative flex items-center w-full overflow-hidden">
                        {/* Desktop Navigation Buttons */}
                        <button
                            onClick={() => scroll('left')}
                            className="hidden md:flex absolute left-4 z-30 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-sm shadow-lg border border-white/20"
                        >
                            <ChevronLeft size={32} />
                        </button>

                        <div
                            ref={scrollContainerRef}
                            className="flex-1 overflow-x-auto overflow-y-hidden flex snap-x snap-mandatory scrollbar-hide touch-pan-x bg-black items-center h-full"
                        >
                            {viewingPhotos.map((url, i) => {
                                const isPdf = url.toLowerCase().includes('.pdf');
                                return (
                                <div key={i} className="flex-none w-full h-full flex flex-col items-center justify-center snap-center p-6 relative">
                                    {isPdf ? (
                                        <div className="w-full flex-1 max-h-full max-w-5xl flex flex-col items-center justify-center bg-white rounded-lg shadow-2xl overflow-hidden relative">
                                            <object
                                                data={url}
                                                type="application/pdf"
                                                className="w-full h-full"
                                            >
                                                <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-gray-50">
                                                    <p className="text-gray-600 mb-4">Your browser does not support inline PDF viewing.</p>
                                                    <a href={url} target="_blank" rel="noopener noreferrer" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium">
                                                        Open PDF in New Tab
                                                    </a>
                                                </div>
                                            </object>
                                            <a href={url} target="_blank" rel="noopener noreferrer" className="absolute top-4 right-4 px-4 py-2 bg-gray-900/80 backdrop-blur text-white text-sm rounded-lg hover:bg-black transition-colors shadow-lg font-medium flex items-center gap-2 z-10">
                                                Open in New Tab
                                            </a>
                                        </div>
                                    ) : (
                                        <img
                                            src={url}
                                            alt={`Photo ${i + 1}`}
                                            className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
                                            loading="lazy"
                                        />
                                    )}
                                </div>
                            )})}
                        </div>

                        <button
                            onClick={() => scroll('right')}
                            className="hidden md:flex absolute right-4 z-30 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-sm shadow-lg border border-white/20"
                        >
                            <ChevronRight size={32} />
                        </button>
                    </div>

                    {/* Footer / Instructions */}
                    <div className="p-4 pb-8 bg-gradient-to-t from-black/80 to-transparent absolute bottom-0 left-0 right-0 z-20 flex justify-center">
                        <div className="flex gap-1.5">
                            {viewingPhotos.map((_, i) => (
                                <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${'bg-white/40 w-1.5'}`} />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

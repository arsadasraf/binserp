import React, { useState } from 'react';
import { X, Download, Package, Calendar, User, FileText, ChevronRight, Clock, CheckCircle, Activity, Image as ImageIcon, Truck } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { API_BASE_URL } from "@/src/utils/config";
import { useGetStoreDispatchesQuery } from "@/src/store/services/storeService";
import StoreCreateDispatchModal from './StoreCreateDispatchModal';

interface OrderDetailModalProps {
    order: any;
    isOpen: boolean;
    onClose: () => void;
    onUpdateStatus?: (id: string, status: string) => void;
    storeView?: boolean;
}

export default function OrderDetailModal({ order, isOpen, onClose, onUpdateStatus, storeView }: OrderDetailModalProps) {
    const [optimisticStatus, setOptimisticStatus] = useState(order?.status);
    const [activeTab, setActiveTab] = useState<'details' | 'timeline'>('details');
    const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
    const [showDispatchModal, setShowDispatchModal] = useState(false);

    const { data: dispatches = [], refetch: refetchDispatches } = useGetStoreDispatchesQuery(order?._id, { skip: !isOpen || !order?._id });

    React.useEffect(() => {
        setOptimisticStatus(order?.status);
    }, [order?.status]);

    if (!isOpen || !order) return null;

    const items = order.items || [];
    const totalAmount = order.totalAmount || items.reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0);

    const handleDownloadPDF = () => {
        const doc = new jsPDF();

        // Title
        doc.setFontSize(20);
        doc.setTextColor(79, 70, 229); // Indigo
        doc.text(`Order #${order.orderNumber || ''}`, 14, 20);

        // Order Details Section
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text('Order Details', 14, 35);

        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        const orderDetails = [
            ['PO Reference:', String(order.poReference || 'N/A')],
            ['Customer:', String(order.customerName || 'N/A')],
            ['Target Date:', order.targetDate ? new Date(order.targetDate).toLocaleDateString() : 'N/A'],
            ['Status:', String(optimisticStatus || order.status || 'N/A')],
            ['Created:', order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A']
        ];

        let yPos = 42;
        orderDetails.forEach(([label, value]) => {
            doc.setTextColor(100, 100, 100);
            doc.text(String(label), 14, yPos);
            doc.setTextColor(0, 0, 0);
            doc.text(String(value), 60, yPos);
            yPos += 7;
        });

        // Items Table
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text('Order Items', 14, yPos + 10);

        const tableData = items.map((item: any) => [
            String(item.name || item.fgItem?.name || 'Unknown'),
            String(item.description || item.fgItem?.description || 'N/A'),
            String(item.type || 'FGItem'),
            String(item.quantity || 0),
            `Rs. ${(item.pricePerQuantity || 0).toLocaleString()}`,
            `Rs. ${(item.totalPrice || 0).toLocaleString()}`
        ]);

        autoTable(doc, {
            startY: yPos + 15,
            head: [['Product', 'Description', 'Type', 'Qty', 'Price', 'Total']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [79, 70, 229], textColor: 255 },
            styles: { fontSize: 9 },
            columnStyles: {
                0: { cellWidth: 40 },
                1: { cellWidth: 50 },
                2: { cellWidth: 20 },
                3: { cellWidth: 15 },
                4: { cellWidth: 25 },
                5: { cellWidth: 25 }
            }
        });

        // Total
        const finalY = (doc as any).lastAutoTable?.finalY || yPos + 50;
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text('Total Order Value:', 120, finalY + 10);
        doc.setTextColor(79, 70, 229);
        doc.setFontSize(14);
        doc.text(`Rs. ${totalAmount.toLocaleString()}`, 170, finalY + 10);

        // Statistics
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Total Items: ${items.length}`, 14, finalY + 20);
        doc.text(`Total Quantity: ${items.reduce((s: number, i: any) => s + (i.quantity || 0), 0)}`, 14, finalY + 27);

        // Remarks if available
        if (order.remarks) {
            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            doc.text('Remarks:', 14, finalY + 40);
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            const splitRemarks = doc.splitTextToSize(String(order.remarks), 180);
            doc.text(splitRemarks, 14, finalY + 47);
        }

        // Footer
        const pageCount = (doc as any).internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.text(
                `Generated on ${new Date().toLocaleDateString()} | Page ${i} of ${pageCount}`,
                14,
                doc.internal.pageSize.height - 10
            );
        }

        // Save PDF
        doc.save(`Order_${order.orderNumber || 'new'}_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const statusOptions = [
        { id: 'Pending', label: 'Pending', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500' },
        { id: 'InProgress', label: 'WIP', icon: Activity, color: 'text-blue-500', bg: 'bg-blue-500' },
        { id: 'Completed', label: 'Completed', icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500' },
        { id: 'Dispatched', label: 'Dispatched', icon: Truck, color: 'text-purple-500', bg: 'bg-purple-500' }
    ];

    const displayStatusOptions = storeView ? statusOptions.filter(opt => opt.id === 'Completed' || opt.id === optimisticStatus) : statusOptions;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div
                className="bg-white dark:bg-gray-900 w-full max-w-5xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-100 dark:border-gray-800"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-white dark:bg-gray-900 sticky top-0 z-10">
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Package className="text-indigo-600 dark:text-indigo-400" />
                                Order #{order.orderNumber}
                            </h2>
                            {order.poReference && (
                                <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 text-xs font-medium border border-gray-200 dark:border-gray-700">
                                    PO: {order.poReference}
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1 flex items-center gap-4">
                            <span className="flex items-center gap-1.5">
                                <User size={14} />
                                {order.customerName}
                            </span>
                            <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                            <span className="flex items-center gap-1.5">
                                <Calendar size={14} />
                                Target: {order.targetDate ? new Date(order.targetDate).toLocaleDateString() : 'N/A'}
                            </span>
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Status Toggle */}
                        {onUpdateStatus && (
                            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                                {displayStatusOptions.map((opt) => {
                                    const isActive = optimisticStatus === opt.id;
                                    const Icon = opt.icon;
                                    return (
                                        <button
                                            key={opt.id}
                                            onClick={() => {
                                                setOptimisticStatus(opt.id);
                                                onUpdateStatus(order._id, opt.id);
                                            }}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 ${isActive
                                                ? `bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10 ${opt.color}`
                                                : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5'
                                                }`}
                                        >
                                            <Icon size={12} className={isActive ? opt.color : 'opacity-70'} />
                                            {opt.label}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        <button
                            onClick={handleDownloadPDF}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                            title="Download PDF"
                        >
                            <Download size={20} />
                        </button>
                        <button onClick={onClose} className="p-2 text-gray-500 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>



                {/* Tabs Header */}
                <div className="flex border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-6">
                    <button
                        onClick={() => setActiveTab('details')}
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'details'
                            ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                    >
                        Order Details
                    </button>
                    <button
                        onClick={() => setActiveTab('timeline')}
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'timeline'
                            ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                    >
                        Timeline & Dispatches
                    </button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col md:flex-row relative">
                    {/* Tab Content */}
                    {activeTab === 'details' && (
                        <>
                            {/* Left Panel: Items List */}
                            <div className="flex-1 overflow-y-auto p-0 bg-gray-50/50 dark:bg-gray-900/50">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 font-medium sticky top-0 border-b border-gray-200 dark:border-gray-700 z-10">
                                        <tr>
                                            <th className="px-6 py-3">Product</th>
                                            <th className="px-6 py-3">Description</th>
                                            <th className="px-6 py-3">Type</th>
                                            <th className="px-6 py-3 text-right">Qty</th>
                                            <th className="px-6 py-3 text-right">Price</th>
                                            <th className="px-6 py-3 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                                        {items.map((item: any, idx: number) => (
                                            <tr
                                                key={idx}
                                                className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center overflow-hidden shrink-0">
                                                            {item.photosSnapshot && item.photosSnapshot.length > 0 ? (
                                                                <img src={item.photosSnapshot[0]} alt="" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <Package size={18} className="text-gray-400" />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                                                                {item.name || item.fgItem?.name || 'Unknown Product'}
                                                                <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 text-gray-400 transition-opacity" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-gray-500 text-xs max-w-xs truncate">
                                                    {item.description || item.fgItem?.description || '-'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-100">
                                                        {item.type || 'FGItem'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right font-medium text-gray-900 dark:text-white">
                                                    {item.quantity}
                                                </td>
                                                <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-400">
                                                    ₹{(item.pricePerQuantity || 0).toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 text-right font-bold text-gray-900 dark:text-white">
                                                    ₹{(item.totalPrice || 0).toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                        {items.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic">No items found</td>
                                            </tr>
                                        )}
                                    </tbody>
                                    <tfoot className="bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 font-bold">
                                        <tr>
                                            <td colSpan={5} className="px-6 py-4 text-right text-gray-600 dark:text-gray-300">Total Order Value</td>
                                            <td className="px-6 py-4 text-right text-indigo-600 dark:text-indigo-400 text-lg">
                                                ₹{totalAmount.toLocaleString()}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            {/* Right Panel: Additional Info & Photos */}
                            <div className="w-full md:w-80 border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-y-auto p-6 space-y-6">

                                {/* Photos Section */}
                                <div>
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <ImageIcon size={14} />
                                        Order Photos
                                    </h3>
                                    {order.photos && order.photos.length > 0 ? (
                                        <div className="grid grid-cols-2 gap-2">
                                            {order.photos.map((photo: string, idx: number) => (
                                                <div
                                                    key={idx}
                                                    className="aspect-square rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                                                    onClick={() => setPreviewPhoto(photo)}
                                                >
                                                    <img src={photo} alt="" className="w-full h-full object-cover" />
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 text-center">
                                            <ImageIcon size={24} className="mx-auto text-gray-300 mb-2" />
                                            <p className="text-xs text-gray-400">No photos attached</p>
                                        </div>
                                    )}
                                </div>

                                {/* Attached Document Section */}
                                {order.pdf && (
                                    <div>
                                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                            <FileText size={14} />
                                            Attached Document
                                        </h3>
                                        <a
                                            href={order.pdf}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="flex items-center gap-3 p-3 bg-red-50 hover:bg-red-100 rounded-xl border border-red-100 transition-colors group"
                                        >
                                            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                                                <span className="text-red-600 font-bold text-xs">PDF</span>
                                            </div>
                                            <div className="flex-1 overflow-hidden">
                                                <p className="text-sm font-semibold text-gray-900 truncate">PO Document</p>
                                                <p className="text-xs text-gray-500">Click to view/download</p>
                                            </div>
                                            <Download size={16} className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </a>
                                    </div>
                                )}

                                {/* Recent Activity / Tracking Summary (Placeholder) */}
                                <div>
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <Activity size={14} />
                                        Statistics
                                    </h3>
                                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 space-y-3">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-gray-500">Total Items</span>
                                            <span className="font-medium text-gray-900 dark:text-white">{items.length}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-gray-500">Total Qty</span>
                                            <span className="font-medium text-gray-900 dark:text-white">
                                                {items.reduce((s: number, i: any) => s + (i.quantity || 0), 0)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-gray-500">Status</span>
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${order.status === 'Dispatched' ? 'bg-purple-100 text-purple-700' :
                                                order.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                                    order.status === 'InProgress' ? 'bg-blue-100 text-blue-700' :
                                                        'bg-amber-100 text-amber-700'
                                                }`}>
                                                {order.status}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {order.remarks && (
                                    <div>
                                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                            <FileText size={14} />
                                            Remarks
                                        </h3>
                                        <div className="bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-xl border border-yellow-100 dark:border-yellow-900/30 text-sm text-yellow-800 dark:text-yellow-200">
                                            {order.remarks}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {activeTab === 'timeline' && (
                        <div className="flex-1 overflow-y-auto p-8 bg-gray-50 dark:bg-gray-900/50">
                            <div className="max-w-3xl mx-auto">
                                <div className="relative border-l-2 border-indigo-200 dark:border-indigo-900/50 ml-4 space-y-8 pb-8">
                                    
                                    {/* Order Created Node */}
                                    <div className="relative">
                                        <div className="absolute -left-[25px] w-12 h-12 rounded-full bg-white dark:bg-gray-900 border-4 border-indigo-100 flex items-center justify-center shadow-sm">
                                            <Package size={20} className="text-indigo-500" />
                                        </div>
                                        <div className="pl-10">
                                            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                                                <h4 className="font-bold text-gray-900 dark:text-white flex items-center justify-between">
                                                    Order Created
                                                    <span className="text-xs font-normal text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</span>
                                                </h4>
                                                <p className="text-sm text-gray-600 mt-1">
                                                    Order #{order.orderNumber} placed by {order.customerName || order.customer?.name}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Dispatch Nodes */}
                                    {dispatches.map((dispatch: any, idx: number) => (
                                        <div key={dispatch._id} className="relative">
                                            <div className="absolute -left-[21px] w-10 h-10 rounded-full bg-white dark:bg-gray-900 border-2 border-blue-200 flex items-center justify-center shadow-sm z-10">
                                                <Truck size={16} className="text-blue-500" />
                                            </div>
                                            <div className="pl-10">
                                                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden">
                                                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                                                    
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div>
                                                            <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                                Partial Dispatch: {dispatch.dispatchNumber}
                                                            </h4>
                                                            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                                                                <Calendar size={12}/> {new Date(dispatch.dispatchDate).toLocaleDateString()}
                                                                {dispatch.createdBy && (
                                                                    <>
                                                                        <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                                                        <User size={12}/> {dispatch.createdBy.name}
                                                                    </>
                                                                )}
                                                            </p>
                                                        </div>
                                                        {dispatch.pdf && (
                                                            <a href={dispatch.pdf} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-100 transition-colors">
                                                                <FileText size={14}/>
                                                                Dispatch Slip
                                                            </a>
                                                        )}
                                                    </div>

                                                    <div className="mb-4">
                                                        <h5 className="text-xs font-semibold text-gray-400 uppercase mb-2">Dispatched Items</h5>
                                                        <ul className="space-y-1.5">
                                                            {dispatch.items.map((di: any, i: number) => (
                                                                <li key={i} className="flex justify-between text-sm items-center bg-gray-50/50 dark:bg-gray-800/50 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-gray-700">
                                                                    <span className="font-medium text-gray-700 dark:text-gray-300">{di.fgItem?.name || 'Item'}</span>
                                                                    <span className="font-bold text-gray-900 dark:text-white bg-white dark:bg-gray-900 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-600">
                                                                        {di.dispatchedQuantity} <span className="text-gray-400 text-xs font-normal">qty</span>
                                                                    </span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                    
                                                    {dispatch.vehicleNumber && (
                                                        <div className="flex items-center gap-3 text-xs text-gray-500 bg-gray-50 dark:bg-gray-800/50 p-2.5 rounded-lg border border-gray-100 dark:border-gray-700 mb-3">
                                                            <div className="flex items-center gap-1.5">
                                                                <Truck size={14} className="text-gray-400"/>
                                                                <span className="font-medium uppercase tracking-wider">{dispatch.vehicleNumber}</span>
                                                            </div>
                                                            {dispatch.driverName && (
                                                                <>
                                                                    <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                                                    <div className="flex items-center gap-1.5">
                                                                        <User size={14} className="text-gray-400"/>
                                                                        <span>{dispatch.driverName}</span>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}

                                                    {dispatch.photos && dispatch.photos.length > 0 && (
                                                        <div className="flex gap-2 mt-2">
                                                            {dispatch.photos.map((photo: string, pIdx: number) => (
                                                                <div 
                                                                    key={pIdx} 
                                                                    onClick={() => setPreviewPhoto(photo)}
                                                                    className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden cursor-pointer hover:ring-2 ring-indigo-500 ring-offset-1 transition-all"
                                                                >
                                                                    <img src={photo} alt="Dispatch proof" className="w-full h-full object-cover" />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Order Completed Node */}
                                    {order.status === 'Completed' || order.status === 'Dispatched' ? (
                                        <div className="relative">
                                            <div className="absolute -left-[21px] w-10 h-10 rounded-full bg-green-100 border-2 border-green-500 flex items-center justify-center shadow-sm z-10">
                                                <CheckCircle size={16} className="text-green-600" />
                                            </div>
                                            <div className="pl-10">
                                                <div className="bg-green-50/50 p-4 rounded-xl border border-green-100 text-green-800 font-medium">
                                                    Order Fully Dispatched
                                                </div>
                                            </div>
                                        </div>
                                    ) : null}

                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Photo Preview Modal */}
            {
                previewPhoto && (
                    <div
                        className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md"
                        onClick={() => setPreviewPhoto(null)}
                    >
                        <img src={previewPhoto} alt="Preview" className="max-w-full max-h-full rounded-lg shadow-2xl" />
                        <button className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full">
                            <X size={32} />
                        </button>
                    </div>
                )
            }
            
            {showDispatchModal && (
                <StoreCreateDispatchModal
                    isOpen={showDispatchModal}
                    onClose={() => setShowDispatchModal(false)}
                    order={order}
                    onSuccess={() => {
                        refetchDispatches();
                        if (onUpdateStatus) {
                            // trigger a list refetch if needed, handled by RTK tags usually
                        }
                    }}
                />
            )}
        </div >
    );
}

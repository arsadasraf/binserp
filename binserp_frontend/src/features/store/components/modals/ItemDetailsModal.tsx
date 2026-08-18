import React, { useEffect, useState } from 'react';
import { 
  X, 
  Download, 
  Package, 
  Calendar, 
  MapPin, 
  Factory, 
  Edit2, 
  Info, 
  TrendingUp, 
  ArrowDownLeft, 
  ArrowUpRight, 
  FileText, 
  Layers, 
  Clock,
  ShieldCheck
} from 'lucide-react';
import { apiGet, apiPost } from '@/src/lib/api';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ItemDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: any; // The inventory item object
    type: 'bo' | 'inhouse';
}

export default function ItemDetailsModal({ isOpen, onClose, item, type }: ItemDetailsModalProps) {
    const [activeTab, setActiveTab] = useState<'normal' | 'flow'>('normal');
    const [history, setHistory] = useState<any[]>([]);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [editingStock, setEditingStock] = useState<boolean>(false);
    const [editingStockValue, setEditingStockValue] = useState<number>(0);
    const [displayOpeningStock, setDisplayOpeningStock] = useState<number | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

    useEffect(() => {
        setDisplayOpeningStock(item?.monthlyData?.openingStock ?? null);
    }, [item]);

    const handleOpeningStockEditClick = () => {
        setEditingStock(true);
        setEditingStockValue(displayOpeningStock !== null ? displayOpeningStock : (item?.monthlyData?.openingStock || 0));
    };

    const handleOpeningStockSave = async () => {
        setIsUpdating(true);
        try {
            const currentDate = new Date();
            const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
            
            const endpoint = type === 'bo' ? '/api/store/monthly-inventory/rm' : '/api/store/monthly-inventory/fg';
            const payload = type === 'bo' ? {
                materialId: item.material || item.materialId || item._id,
                month: currentMonthStr,
                openingStock: editingStockValue
            } : {
                fgItemId: item._id,
                month: currentMonthStr,
                openingStock: editingStockValue
            };

            await apiPost(endpoint, payload, token);
            setDisplayOpeningStock(editingStockValue);
        } catch (err) {
            console.error("Failed to update opening stock", err);
        } finally {
            setIsUpdating(false);
            setEditingStock(false);
        }
    };

    useEffect(() => {
        if (isOpen && item && token) {
            fetchHistory();
        } else {
            setHistory([]);
            setTransactions([]);
        }
    }, [isOpen, item, type]);

    const targetId = item && (type === 'bo'
        ? (item.materialId ? (typeof item.materialId === 'object' ? item.materialId._id : item.materialId) : item._id)
        : item._id);

    const fetchHistory = async () => {
        setLoading(true);
        setError('');
        try {
            // Fetch GRN history
            const grnEndpoint = `/api/store/grn/history/${type}/${targetId}`;
            const result = await apiGet(grnEndpoint, token);
            setHistory(result.grns || []);

            // Fetch transaction ledger history for item
            try {
                const txEndpoint = `/api/store/transactions/item/${targetId}`;
                const txResult = await apiGet(txEndpoint, token);
                setTransactions(txResult.transactions || []);
            } catch (txErr) {
                console.warn("Could not fetch item transactions:", txErr);
                setTransactions([]);
            }
        } catch (err: any) {
            console.error("Failed to fetch history:", err);
            setError("Failed to load history.");
        } finally {
            setLoading(false);
        }
    };

    // Separate top 5 inward & outward transactions
    const inwardTransactions = transactions.filter(t => t.movementType === 'INWARD').slice(0, 5);
    const outwardTransactions = transactions.filter(t => t.movementType === 'OUTWARD').slice(0, 5);

    const downloadPDF = () => {
        const doc = new jsPDF();

        // Title Header
        doc.setFontSize(18);
        doc.text(`Item Report: ${item?.materialName || item?.componentName || item?.name}`, 14, 20);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Item Code: ${item?.materialCode || item?.componentCode || item?.code || '-'} | Generated on: ${new Date().toLocaleDateString()}`, 14, 28);

        // General Info Table
        autoTable(doc, {
            startY: 35,
            head: [['Attribute', 'Details']],
            body: [
                ['Item Name', item?.materialName || item?.componentName || item?.name || '-'],
                ['Item Code', item?.materialCode || item?.componentCode || item?.code || '-'],
                ['Item Type', type === 'bo' ? 'Bought Out Material' : 'In-House Component'],
                ['Current Stock', `${type === 'bo' ? item?.currentStock : item?.quantity} ${item?.unit || ''}`],
                ['Opening Stock', `${displayOpeningStock !== null ? displayOpeningStock : (item?.monthlyData?.openingStock || 0)} ${item?.unit || ''}`],
                ['Min Stock / Reorder', `${item?.minimumStock || item?.reorderLevel || 0} ${item?.unit || ''}`],
                ['Category / Type', type === 'bo' ? (item?.categoryId?.name || item?.category?.name || item?.category || '-') : (item?.type || '-')],
                ['Location', item?.locationId?.name || item?.location?.name || item?.location || '-'],
                ['Description', item?.descriptions || item?.description || '-'],
            ],
            theme: 'striped',
            headStyles: { fillColor: [79, 70, 229] },
        });

        // Top 5 Inward Title & Table
        let finalY = (doc as any).lastAutoTable.finalY || 40;
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text("Top 5 Recent Inward Receipts (GRN)", 14, finalY + 15);

        const historyRows = history.slice(0, 5).map(grn => {
            const grnItem = grn.items?.find((i: any) =>
                (type === 'bo' && (i.material?._id === targetId || i.material === targetId)) ||
                (type === 'inhouse' && (i.component?._id === targetId || i.component === targetId || i.fgItem?._id === targetId || i.fgItem === targetId))
            );

            return [
                new Date(grn.date).toLocaleDateString(),
                grn.grnNumber,
                type === 'bo' ? (grn.supplier?.name || 'N/A') : 'Production GRN',
                grnItem ? `${grnItem.quantity || grnItem.receivedQuantity} ${grnItem.unit || ''}` : '-',
                grnItem ? (grnItem.acceptedQuantity || 0) : '-',
                grn.qcStatus || 'N/A'
            ];
        });

        autoTable(doc, {
            startY: finalY + 20,
            head: [['Date', 'GRN No.', 'Supplier / Source', 'Rcv Qty', 'Acc Qty', 'QC Status']],
            body: historyRows.length > 0 ? historyRows : [['No recent inward history found', '-', '-', '-', '-', '-']],
            theme: 'grid',
            headStyles: { fillColor: [16, 185, 129] },
        });

        // Top 5 Outward Title & Table
        finalY = (doc as any).lastAutoTable.finalY || 80;
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text("Top 5 Recent Outward Dispatches", 14, finalY + 15);

        const outwardRows = outwardTransactions.slice(0, 5).map(tx => [
            new Date(tx.timestamp || tx.createdAt).toLocaleDateString(),
            tx.referenceDocNumber || 'N/A',
            tx.recipientOrSource || 'Shopfloor / Dispatch',
            `-${tx.quantity} ${tx.unit || ''}`,
            tx.purpose || tx.transactionCategory || 'Outward'
        ]);

        autoTable(doc, {
            startY: finalY + 20,
            head: [['Date', 'Ref / DC No.', 'Destination / Party', 'Qty Issued', 'Purpose']],
            body: outwardRows.length > 0 ? outwardRows : [['No recent outward entries found', '-', '-', '-', '-']],
            theme: 'grid',
            headStyles: { fillColor: [225, 29, 72] },
        });

        doc.save(`Item_Report_${item?.materialCode || item?.code || 'details'}.pdf`);
    };

    if (!isOpen || !item) return null;

    const itemName = item.materialName || item.componentName || item.name;
    const itemCode = item.materialCode || item.componentCode || item.code;
    const stock = type === 'bo' ? item.currentStock : item.quantity;
    const minStock = item.minimumStock || item.reorderLevel || 0;
    const categoryName = item.categoryId?.name || item.category?.name || item.category || '-';
    const locationName = item.locationId?.name || item.location?.name || item.location || '-';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-100 dark:border-gray-800">
                
                {/* Modern Hero Header */}
                <div className="relative bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 overflow-hidden">
                    <div className="absolute -right-10 -top-10 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute left-1/3 -bottom-10 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

                    <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-start gap-4">
                            <div className="p-3.5 bg-white/10 dark:bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 text-indigo-300 shadow-inner">
                                {type === 'bo' ? <Package size={28} /> : <Factory size={28} />}
                            </div>
                            <div>
                                <div className="flex items-center gap-2.5 flex-wrap mb-1">
                                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                        {type === 'bo' ? 'RM / BO Inventory' : 'FG Component'}
                                    </span>
                                    {itemCode && (
                                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-slate-800 text-slate-300 border border-slate-700">
                                            {itemCode}
                                        </span>
                                    )}
                                </div>
                                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">{itemName}</h2>
                            </div>
                        </div>

                        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
                            <div className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border shadow-sm ${
                                stock <= minStock
                                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            }`}>
                                <span className={`w-2 h-2 rounded-full ${stock <= minStock ? 'bg-rose-400 animate-pulse' : 'bg-emerald-400'}`} />
                                {stock <= minStock ? 'Low Stock' : 'Optimal Stock'}
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={downloadPDF}
                                    className="p-2.5 text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl transition-all border border-white/10 cursor-pointer"
                                    title="Export PDF Summary"
                                >
                                    <Download size={17} />
                                </button>
                                <button
                                    onClick={onClose}
                                    className="p-2.5 text-slate-400 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl transition-all border border-white/10 cursor-pointer"
                                >
                                    <X size={17} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tab Switcher Header */}
                <div className="flex border-b border-gray-100 dark:border-gray-800 px-6 bg-gray-50/80 dark:bg-gray-900/80">
                    <button
                        onClick={() => setActiveTab('normal')}
                        className={`flex items-center gap-2 py-3.5 px-5 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
                            activeTab === 'normal'
                                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-gray-900 shadow-sm rounded-t-xl'
                                : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                    >
                        <Info size={16} />
                        <span>Normal Details</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('flow')}
                        className={`flex items-center gap-2 py-3.5 px-5 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
                            activeTab === 'flow'
                                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-gray-900 shadow-sm rounded-t-xl'
                                : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                    >
                        <TrendingUp size={16} />
                        <span>Top 5 Inward & Outward Details</span>
                    </button>
                </div>

                {/* Content Container */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* TAB 1: Normal Details */}
                    {activeTab === 'normal' && (
                        <div className="space-y-6 animate-in fade-in duration-150">
                            {/* Key Stats Cards Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
                                {/* Current Stock Card */}
                                <div className="bg-gray-50 dark:bg-gray-800/80 p-4 rounded-2xl border border-gray-100 dark:border-gray-700/60 shadow-sm">
                                    <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold block mb-1">Current Stock</span>
                                    <span className={`text-xl font-black ${stock <= minStock ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                        {stock} <span className="text-xs font-semibold text-gray-500">{item.unit || ''}</span>
                                    </span>

                                    {/* Opening Stock Quick Edit */}
                                    <div className="mt-2 pt-2 border-t border-gray-200/50 dark:border-gray-700/50 flex items-center justify-between text-xs">
                                        <span className="text-gray-500 font-medium">Opening:</span>
                                        {editingStock ? (
                                            <div className="flex items-center gap-1">
                                                <input 
                                                    type="number" 
                                                    value={editingStockValue} 
                                                    onChange={(e) => setEditingStockValue(Number(e.target.value))}
                                                    className="w-16 px-1.5 py-0.5 border rounded text-xs text-gray-900 bg-white"
                                                    onKeyDown={(e) => e.key === 'Enter' && handleOpeningStockSave()}
                                                    autoFocus
                                                />
                                                <button onClick={handleOpeningStockSave} disabled={isUpdating} className="px-1.5 py-0.5 bg-indigo-600 text-white rounded text-[10px] font-bold">Save</button>
                                                <button onClick={() => setEditingStock(false)} className="px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded text-[10px]">X</button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1">
                                                <span className="font-bold text-gray-800 dark:text-gray-200">
                                                    {displayOpeningStock !== null ? displayOpeningStock : (item?.monthlyData?.openingStock || 0)}
                                                </span>
                                                <button 
                                                    onClick={handleOpeningStockEditClick}
                                                    className="p-1 text-gray-400 hover:text-indigo-600 rounded hover:bg-indigo-50 transition-colors"
                                                    title="Edit opening stock"
                                                >
                                                    <Edit2 size={12} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Category / Type */}
                                <div className="bg-gray-50 dark:bg-gray-800/80 p-4 rounded-2xl border border-gray-100 dark:border-gray-700/60 shadow-sm">
                                    <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold block mb-1">
                                        {type === 'bo' ? 'Category' : 'Component Type'}
                                    </span>
                                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate block" title={type === 'bo' ? categoryName : item.type}>
                                        {type === 'bo' ? categoryName : (item.type || '-')}
                                    </span>
                                </div>

                                {/* Min Stock */}
                                <div className="bg-gray-50 dark:bg-gray-800/80 p-4 rounded-2xl border border-gray-100 dark:border-gray-700/60 shadow-sm">
                                    <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold block mb-1">Min / Reorder Stock</span>
                                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                                        {minStock} <span className="text-xs font-normal text-gray-500">{item.unit}</span>
                                    </span>
                                </div>

                                {/* Storage Location */}
                                <div className="bg-gray-50 dark:bg-gray-800/80 p-4 rounded-2xl border border-gray-100 dark:border-gray-700/60 shadow-sm">
                                    <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold block mb-1">Location</span>
                                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1 truncate" title={locationName}>
                                        <MapPin size={13} className="text-gray-400 shrink-0" />
                                        <span className="truncate">{locationName}</span>
                                    </span>
                                </div>

                                {/* Last Updated */}
                                <div className="bg-gray-50 dark:bg-gray-800/80 p-4 rounded-2xl border border-gray-100 dark:border-gray-700/60 shadow-sm">
                                    <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold block mb-1">Last Updated</span>
                                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1">
                                        <Clock size={13} className="text-gray-400" />
                                        {new Date(item.updatedAt || new Date()).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>

                            {/* Detailed Master Specifications & Attributes */}
                            <div className="bg-white dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 space-y-4 shadow-sm">
                                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                    <Layers size={16} className="text-indigo-600" />
                                    <span>Master Attributes & Financial Details</span>
                                </h3>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                                    <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                                        <span className="text-gray-400 block text-[10px] font-semibold uppercase">Unit Rate (INR)</span>
                                        <span className="font-bold text-gray-800 dark:text-gray-200">
                                            {item.rate ? `₹${item.rate}` : (item.unitRate ? `₹${item.unitRate}` : '-')}
                                        </span>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                                        <span className="text-gray-400 block text-[10px] font-semibold uppercase">GST Rate (%)</span>
                                        <span className="font-bold text-gray-800 dark:text-gray-200">
                                            {item.gstRate !== undefined ? `${item.gstRate}%` : (item.gst !== undefined ? `${item.gst}%` : '-')}
                                        </span>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                                        <span className="text-gray-400 block text-[10px] font-semibold uppercase">HSN Code</span>
                                        <span className="font-bold text-gray-800 dark:text-gray-200 font-mono">
                                            {item.hsnCode || item.hsn || '-'}
                                        </span>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                                        <span className="text-gray-400 block text-[10px] font-semibold uppercase">Rack / Bin</span>
                                        <span className="font-bold text-gray-800 dark:text-gray-200">
                                            {item.rackNumber || item.binNumber ? `${item.rackNumber || ''} / ${item.binNumber || ''}` : '-'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Full Description Card */}
                            <div className="bg-white dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 space-y-2 shadow-sm">
                                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                    <FileText size={16} className="text-indigo-600" />
                                    <span>Item Description</span>
                                </h3>
                                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-gray-900/50 p-3.5 rounded-xl border border-gray-100 dark:border-gray-800 whitespace-pre-wrap">
                                    {item.descriptions || item.description || "No detailed description provided for this item."}
                                </p>
                            </div>

                            {/* Current Month Flow Summary Card */}
                            {item.monthlyData && (
                                <div className="bg-gradient-to-r from-slate-50 to-indigo-50/30 dark:from-gray-800/80 dark:to-gray-800/40 rounded-2xl border border-indigo-100 dark:border-gray-700 p-5 shadow-sm space-y-3">
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center justify-between">
                                        <span className="flex items-center gap-2">
                                            <TrendingUp size={16} className="text-indigo-600" />
                                            Monthly Flow Analytics Summary
                                        </span>
                                        <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">Current Month</span>
                                    </h3>

                                    <div className="grid grid-cols-4 gap-3 text-center text-xs">
                                        <div className="bg-white dark:bg-gray-900 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800">
                                            <span className="text-gray-400 block text-[10px] font-semibold uppercase">Opening</span>
                                            <span className="font-bold text-gray-800 dark:text-gray-200">{item.monthlyData.openingStock || 0}</span>
                                        </div>
                                        <div className="bg-white dark:bg-gray-900 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800">
                                            <span className="text-emerald-600 block text-[10px] font-semibold uppercase">Total Inward</span>
                                            <span className="font-bold text-emerald-600">+{item.monthlyData.totalInwardQuantity || 0}</span>
                                        </div>
                                        <div className="bg-white dark:bg-gray-900 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800">
                                            <span className="text-rose-600 block text-[10px] font-semibold uppercase">Total Outward</span>
                                            <span className="font-bold text-rose-600">-{item.monthlyData.totalOutwardQuantity || 0}</span>
                                        </div>
                                        <div className="bg-white dark:bg-gray-900 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800">
                                            <span className="text-indigo-600 block text-[10px] font-semibold uppercase">Net Closing</span>
                                            <span className="font-extrabold text-indigo-600">{stock}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Active PO & Sales Order Reserved Stock Breakdown Card */}
                            {item.reservedBreakdown && item.reservedBreakdown.length > 0 && (
                                <div className="bg-amber-50/70 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-900/50 p-5 space-y-3 shadow-sm">
                                    <h3 className="text-sm font-bold text-amber-900 dark:text-amber-300 flex items-center justify-between">
                                        <span className="flex items-center gap-2">
                                            <ShieldCheck size={16} className="text-amber-600" />
                                            Active Reserved Stock Breakdown (by Customer PO & Sales Order)
                                        </span>
                                        <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-extrabold bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200">
                                            Total Reserved: {item.allocatedQuantity || 0} {item.unit || 'PCS'}
                                        </span>
                                    </h3>

                                    <div className="overflow-x-auto rounded-xl border border-amber-200/60 dark:border-amber-900/40 bg-white dark:bg-gray-900">
                                        <table className="w-full text-xs text-left">
                                            <thead className="bg-amber-100/60 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 font-extrabold uppercase text-[10px]">
                                                <tr>
                                                    <th className="p-2.5">Sales Order #</th>
                                                    <th className="p-2.5">Customer PO Ref</th>
                                                    <th className="p-2.5">Customer Name</th>
                                                    <th className="p-2.5 text-right">Reserved Qty</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-amber-100 dark:divide-gray-800 font-medium">
                                                {item.reservedBreakdown.map((resItem: any, idx: number) => (
                                                    <tr key={idx} className="hover:bg-amber-50/50 dark:hover:bg-gray-800/40">
                                                        <td className="p-2.5 font-bold text-gray-900 dark:text-white font-mono">
                                                            #{resItem.orderNumber}
                                                        </td>
                                                        <td className="p-2.5 font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                                                            {resItem.poReference ? resItem.poReference : '—'}
                                                        </td>
                                                        <td className="p-2.5 text-gray-700 dark:text-gray-300">
                                                            {resItem.customerName}
                                                        </td>
                                                        <td className="p-2.5 text-right font-mono font-extrabold text-amber-600 dark:text-amber-400">
                                                            {resItem.reservedQuantity} {item.unit || 'PCS'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 2: Top 5 Inward & Outward Details */}
                    {activeTab === 'flow' && (
                        <div className="space-y-6 animate-in fade-in duration-150">

                            {/* Monthly Flow Overview Header */}
                            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                        <Calendar size={16} className="text-indigo-600" />
                                        <span>Monthly Flow Overview</span>
                                    </h3>
                                    <span className="text-xs text-gray-500">Live Inventory Calculations</span>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                    <div className="p-3 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-gray-100 dark:border-gray-800 text-center">
                                        <span className="text-gray-400 block text-[10px] uppercase font-bold">Opening Balance</span>
                                        <span className="text-base font-black text-gray-800 dark:text-gray-200">
                                            {displayOpeningStock !== null ? displayOpeningStock : (item?.monthlyData?.openingStock || 0)} {item.unit}
                                        </span>
                                    </div>
                                    <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-100 dark:border-emerald-900/50 text-center">
                                        <span className="text-emerald-600 dark:text-emerald-400 block text-[10px] uppercase font-bold">Total Inward (+)</span>
                                        <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                                            +{item?.monthlyData?.totalInwardQuantity || 0} {item.unit}
                                        </span>
                                    </div>
                                    <div className="p-3 bg-rose-50/60 dark:bg-rose-950/30 rounded-xl border border-rose-100 dark:border-rose-900/50 text-center">
                                        <span className="text-rose-600 dark:text-rose-400 block text-[10px] uppercase font-bold">Total Outward (-)</span>
                                        <span className="text-base font-black text-rose-600 dark:text-rose-400">
                                            -{item?.monthlyData?.totalOutwardQuantity || 0} {item.unit}
                                        </span>
                                    </div>
                                    <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/50 text-center">
                                        <span className="text-indigo-600 dark:text-indigo-400 block text-[10px] uppercase font-bold">Net Current Stock</span>
                                        <span className="text-base font-black text-indigo-600 dark:text-indigo-400">
                                            {stock} {item.unit}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Section 1: Top 5 Inward Receipts */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                        <div className="p-1.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 rounded-lg">
                                            <ArrowDownLeft size={16} />
                                        </div>
                                        <span>Top 5 Recent Inward Entries (Receipts / GRN)</span>
                                    </h3>
                                    <span className="text-xs text-emerald-600 font-semibold">Inward (+)</span>
                                </div>

                                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
                                    {loading ? (
                                        <div className="p-8 flex justify-center"><LoadingSpinner /></div>
                                    ) : history.length === 0 ? (
                                        <div className="p-8 text-center text-xs text-gray-400">No recent GRN inward entries found for this item.</div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs text-left">
                                                <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800 font-bold text-gray-500 uppercase tracking-wider">
                                                    <tr>
                                                        <th className="px-4 py-3">Date</th>
                                                        <th className="px-4 py-3">GRN No.</th>
                                                        <th className="px-4 py-3">{type === 'bo' ? 'Supplier' : 'Source'}</th>
                                                        <th className="px-4 py-3 text-center">Received Qty</th>
                                                        <th className="px-4 py-3 text-center">Accepted Qty</th>
                                                        <th className="px-4 py-3">QC Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-medium">
                                                    {history.slice(0, 5).map((grn) => {
                                                        const grnItem = grn.items?.find((i: any) =>
                                                            (type === 'bo' && (i.material?._id === targetId || i.material === targetId)) ||
                                                            (type === 'inhouse' && (i.component?._id === targetId || i.component === targetId || i.fgItem?._id === targetId || i.fgItem === targetId))
                                                        );

                                                        return (
                                                            <tr key={grn._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                                                <td className="px-4 py-3 font-mono text-gray-600 dark:text-gray-300">
                                                                    {new Date(grn.date).toLocaleDateString()}
                                                                </td>
                                                                <td className="px-4 py-3 font-semibold text-indigo-600 dark:text-indigo-400 font-mono">
                                                                    {grn.grnNumber}
                                                                </td>
                                                                <td className="px-4 py-3 text-gray-800 dark:text-gray-200">
                                                                    {type === 'bo' ? (grn.supplier?.name || 'N/A') : 'In-House Production'}
                                                                </td>
                                                                <td className="px-4 py-3 text-center font-bold text-emerald-600">
                                                                    +{grnItem ? (grnItem.quantity || grnItem.receivedQuantity) : '-'} {item.unit}
                                                                </td>
                                                                <td className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">
                                                                    {grnItem ? (grnItem.acceptedQuantity || 0) : '-'}
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                                        grn.qcStatus === 'Completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' :
                                                                        grn.qcStatus === 'Pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' :
                                                                        'bg-gray-100 text-gray-600'
                                                                    }`}>
                                                                        {grn.qcStatus || 'N/A'}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Section 2: Top 5 Outward Dispatches */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                        <div className="p-1.5 bg-rose-100 dark:bg-rose-950 text-rose-600 rounded-lg">
                                            <ArrowUpRight size={16} />
                                        </div>
                                        <span>Top 5 Recent Outward Entries (Material Issues / Dispatches)</span>
                                    </h3>
                                    <span className="text-xs text-rose-600 font-semibold">Outward (-)</span>
                                </div>

                                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
                                    {loading ? (
                                        <div className="p-8 flex justify-center"><LoadingSpinner /></div>
                                    ) : outwardTransactions.length === 0 ? (
                                        <div className="p-8 text-center text-xs text-gray-400">No recent outward dispatch entries found for this item.</div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs text-left">
                                                <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800 font-bold text-gray-500 uppercase tracking-wider">
                                                    <tr>
                                                        <th className="px-4 py-3">Date</th>
                                                        <th className="px-4 py-3">Ref Doc / DC No.</th>
                                                        <th className="px-4 py-3">Destination / Recipient</th>
                                                        <th className="px-4 py-3 text-right">Quantity Issued</th>
                                                        <th className="px-4 py-3">Purpose / Category</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-medium">
                                                    {outwardTransactions.slice(0, 5).map((tx) => (
                                                        <tr key={tx._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                                            <td className="px-4 py-3 font-mono text-gray-600 dark:text-gray-300">
                                                                {new Date(tx.timestamp || tx.createdAt).toLocaleDateString()}
                                                            </td>
                                                            <td className="px-4 py-3 font-semibold text-rose-600 dark:text-rose-400 font-mono">
                                                                {tx.referenceDocNumber || 'N/A'}
                                                            </td>
                                                            <td className="px-4 py-3 text-gray-800 dark:text-gray-200">
                                                                {tx.recipientOrSource || 'Shopfloor Production'}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-bold text-rose-600">
                                                                -{tx.quantity} {tx.unit || item.unit}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/50">
                                                                    {tx.purpose || tx.transactionCategory || 'Outward Issue'}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

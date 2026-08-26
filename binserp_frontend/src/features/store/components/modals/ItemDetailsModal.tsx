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

    const [historyDatePreset, setHistoryDatePreset] = useState<'all' | 'today' | 'this_month' | 'last_30_days' | 'custom'>('all');
    const [historyStartDate, setHistoryStartDate] = useState('');
    const [historyEndDate, setHistoryEndDate] = useState('');

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

    // Filtered History (GRNs) based on Date Filter
    const filteredHistory = React.useMemo(() => {
        let list = [...history];
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        if (historyDatePreset === 'today') {
            list = list.filter((g: any) => new Date(g.date || g.createdAt) >= startOfToday);
        } else if (historyDatePreset === 'this_month') {
            list = list.filter((g: any) => new Date(g.date || g.createdAt) >= startOfMonth);
        } else if (historyDatePreset === 'last_30_days') {
            list = list.filter((g: any) => new Date(g.date || g.createdAt) >= thirtyDaysAgo);
        } else if (historyDatePreset === 'custom') {
            if (historyStartDate) {
                const sDate = new Date(historyStartDate);
                sDate.setHours(0, 0, 0, 0);
                list = list.filter((g: any) => new Date(g.date || g.createdAt) >= sDate);
            }
            if (historyEndDate) {
                const eDate = new Date(historyEndDate);
                eDate.setHours(23, 59, 59, 999);
                list = list.filter((g: any) => new Date(g.date || g.createdAt) <= eDate);
            }
        }
        return list;
    }, [history, historyDatePreset, historyStartDate, historyEndDate]);

    // Filtered Outward Transactions & QC Rejections based on Date Filter
    const filteredOutwardTransactions = React.useMemo(() => {
        let list = transactions.filter(t => 
            t.movementType === 'OUTWARD' || 
            t.transactionCategory?.includes('REJECT') || 
            t.transactionCategory?.includes('SCRAP')
        );

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        if (historyDatePreset === 'today') {
            list = list.filter((t: any) => new Date(t.timestamp || t.createdAt) >= startOfToday);
        } else if (historyDatePreset === 'this_month') {
            list = list.filter((t: any) => new Date(t.timestamp || t.createdAt) >= startOfMonth);
        } else if (historyDatePreset === 'last_30_days') {
            list = list.filter((t: any) => new Date(t.timestamp || t.createdAt) >= thirtyDaysAgo);
        } else if (historyDatePreset === 'custom') {
            if (historyStartDate) {
                const sDate = new Date(historyStartDate);
                sDate.setHours(0, 0, 0, 0);
                list = list.filter((t: any) => new Date(t.timestamp || t.createdAt) >= sDate);
            }
            if (historyEndDate) {
                const eDate = new Date(historyEndDate);
                eDate.setHours(23, 59, 59, 999);
                list = list.filter((t: any) => new Date(t.timestamp || t.createdAt) <= eDate);
            }
        }
        return list;
    }, [transactions, historyDatePreset, historyStartDate, historyEndDate]);

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

        const outwardRows = filteredOutwardTransactions.slice(0, 5).map((tx: any) => [
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
    const stock = item.currentStock !== undefined ? item.currentStock : (item.quantity ?? 0);
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

                            {/* Date Filter Toolbar */}
                            <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-700 flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                        <Calendar size={13} className="text-indigo-600 dark:text-indigo-400" /> Filter Inward / Outward by Date
                                    </span>
                                    {(historyDatePreset !== 'all' || historyStartDate || historyEndDate) && (
                                        <button
                                            onClick={() => {
                                                setHistoryDatePreset('all');
                                                setHistoryStartDate('');
                                                setHistoryEndDate('');
                                            }}
                                            className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                                        >
                                            Reset Filter
                                        </button>
                                    )}
                                </div>

                                <div className="flex flex-wrap gap-1.5 items-center">
                                    {[
                                        { key: 'all', label: 'All Time' },
                                        { key: 'today', label: 'Today' },
                                        { key: 'this_month', label: 'This Month' },
                                        { key: 'last_30_days', label: 'Last 30 Days' },
                                        { key: 'custom', label: 'Custom Range' },
                                    ].map((btn) => (
                                        <button
                                            key={btn.key}
                                            onClick={() => setHistoryDatePreset(btn.key as any)}
                                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                                                historyDatePreset === btn.key
                                                    ? 'bg-indigo-600 text-white shadow-xs'
                                                    : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'
                                            }`}
                                        >
                                            {btn.label}
                                        </button>
                                    ))}
                                </div>

                                {historyDatePreset === 'custom' && (
                                    <div className="flex items-center gap-2 pt-1">
                                        <div className="flex-1 flex items-center gap-1.5 bg-white dark:bg-gray-700 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-xs">
                                            <span className="text-[11px] text-gray-400 font-medium">From:</span>
                                            <input
                                                type="date"
                                                value={historyStartDate}
                                                onChange={(e) => setHistoryStartDate(e.target.value)}
                                                className="bg-transparent focus:outline-none text-gray-800 dark:text-gray-200 w-full text-xs"
                                            />
                                        </div>
                                        <div className="flex-1 flex items-center gap-1.5 bg-white dark:bg-gray-700 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-xs">
                                            <span className="text-[11px] text-gray-400 font-medium">To:</span>
                                            <input
                                                type="date"
                                                value={historyEndDate}
                                                onChange={(e) => setHistoryEndDate(e.target.value)}
                                                className="bg-transparent focus:outline-none text-gray-800 dark:text-gray-200 w-full text-xs"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Section 1: Inward Receipts & QC Passes */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                        <div className="p-1.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 rounded-lg">
                                            <ArrowDownLeft size={16} />
                                        </div>
                                        <span>Recent Inward Entries (Receipts / GRN)</span>
                                    </h3>
                                    <span className="text-xs text-emerald-600 font-semibold">{filteredHistory.length} Entries</span>
                                </div>

                                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
                                    {loading ? (
                                        <div className="p-8 flex justify-center"><LoadingSpinner /></div>
                                    ) : filteredHistory.length === 0 ? (
                                        <div className="p-8 text-center text-xs text-gray-400">No inward GRN entries found for selected date range.</div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs text-left">
                                                <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800 font-bold text-gray-500 uppercase tracking-wider">
                                                    <tr>
                                                        <th className="px-4 py-3">Date</th>
                                                        <th className="px-4 py-3">Ref / GRN No.</th>
                                                        <th className="px-4 py-3">Supplier / Conversion Vendor</th>
                                                        <th className="px-4 py-3 text-center">Received Qty</th>
                                                        <th className="px-4 py-3 text-center">Accepted Qty</th>
                                                        <th className="px-4 py-3">QC Status</th>
                                                        <th className="px-4 py-3">Inward Done By</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-medium">
                                                    {filteredHistory.slice(0, 10).map((grn) => {
                                                        const grnItem = grn.items?.find((i: any) =>
                                                            i.material?._id === targetId || i.material === targetId ||
                                                            i.consumable?._id === targetId || i.consumable === targetId ||
                                                            i.component?._id === targetId || i.component === targetId ||
                                                            i.fgItem?._id === targetId || i.fgItem === targetId
                                                        );

                                                        const isConversion = grn.isConversion || grn.transactionCategory === 'RM_CONVERSION_INWARD';
                                                        const sourceDisplay = isConversion
                                                            ? (grn.supplierName || grn.supplier?.name || grn.recipientOrSource || 'RM Conversion Vendor')
                                                            : (grn.supplier?.name || grn.supplierName || ((type as string) === 'inhouse' || (type as string) === 'fg' ? 'In-House Production' : 'Supplier'));

                                                        const rejCount = Number(grnItem?.rejectedQuantity) || 0;

                                                        return (
                                                            <tr key={grn._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                                                <td className="px-4 py-3 font-mono text-gray-600 dark:text-gray-300">
                                                                    {new Date(grn.date || grn.createdAt).toLocaleDateString()}
                                                                </td>
                                                                <td className="px-4 py-3 font-semibold text-indigo-600 dark:text-indigo-400 font-mono">
                                                                    {grn.grnNumber}
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <div className="flex flex-col">
                                                                        <span className={`font-semibold ${isConversion ? 'text-purple-700 dark:text-purple-300' : 'text-gray-800 dark:text-gray-200'}`}>
                                                                            {sourceDisplay}
                                                                        </span>
                                                                        {isConversion && (
                                                                            <span className="text-[9px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                                                                                RM Conversion
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3 text-center font-bold text-emerald-600">
                                                                    +{grnItem ? (grnItem.quantity || grnItem.receivedQuantity) : (grn.quantity || '-')} {item.unit}
                                                                </td>
                                                                <td className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">
                                                                    <div>
                                                                        {grnItem ? (grnItem.acceptedQuantity !== undefined ? grnItem.acceptedQuantity : (grnItem.quantity || '-')) : '-'}
                                                                    </div>
                                                                    {rejCount > 0 && (
                                                                        <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 block">
                                                                            ({rejCount} rejected)
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                                        grn.qcStatus === 'Completed' || isConversion ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' :
                                                                        grn.qcStatus === 'Pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' :
                                                                        grn.qcStatus === 'Rejected' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' :
                                                                        'bg-gray-100 text-gray-600'
                                                                    }`}>
                                                                        {grn.qcStatus || (isConversion ? 'Completed' : 'N/A')}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3 font-bold text-indigo-600 dark:text-indigo-300">
                                                                    {grn.receivedBy?.name || grn.receivedBy?.username || grn.receivedBy || 'Store Admin'}
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

                            {/* Section 2: Outward Dispatches & QC Rejections */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                        <div className="p-1.5 bg-rose-100 dark:bg-rose-950 text-rose-600 rounded-lg">
                                            <ArrowUpRight size={16} />
                                        </div>
                                        <span>Recent Outward & QC Rejection Entries</span>
                                    </h3>
                                    <span className="text-xs text-rose-600 font-semibold">{filteredOutwardTransactions.length} Entries</span>
                                </div>

                                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
                                    {loading ? (
                                        <div className="p-8 flex justify-center"><LoadingSpinner /></div>
                                    ) : filteredOutwardTransactions.length === 0 ? (
                                        <div className="p-8 text-center text-xs text-gray-400">No outward or rejection entries found for selected date range.</div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs text-left">
                                                <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800 font-bold text-gray-500 uppercase tracking-wider">
                                                    <tr>
                                                        <th className="px-4 py-3">Date</th>
                                                        <th className="px-4 py-3">Ref Doc / DC No.</th>
                                                        <th className="px-4 py-3">Destination / Recipient</th>
                                                        <th className="px-4 py-3 text-right">Quantity</th>
                                                        <th className="px-4 py-3">Purpose / Category</th>
                                                        <th className="px-4 py-3">Issued / Action By</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-medium">
                                                    {filteredOutwardTransactions.slice(0, 10).map((tx) => {
                                                        const isQCRejection = tx.transactionCategory?.includes("REJECT") || tx.transactionCategory === "INCOMING_QC_REJECTED" || tx.transactionCategory === "JOBWORK_QC_REJECTED";
                                                        const isJobWork = tx.referenceDocType === "JobWorkChallan" || tx.transactionCategory?.includes("JOB_WORK") || tx.transactionCategory?.includes("RM_CONVERSION");
                                                        const isSales = tx.referenceDocType === "DeliveryChallan" || tx.referenceDocType === "Invoice" || tx.transactionCategory?.includes("SALES");
                                                        
                                                        let destinationDisplay = tx.recipientOrSource;
                                                        if (isQCRejection) {
                                                            destinationDisplay = tx.recipientOrSource || "Vendor QC Rejection";
                                                        } else if (isJobWork) {
                                                            destinationDisplay = tx.recipientOrSource && tx.recipientOrSource !== "Store" ? tx.recipientOrSource : "Job Work Vendor";
                                                        } else if (isSales) {
                                                            destinationDisplay = tx.recipientOrSource && tx.recipientOrSource !== "Store" ? tx.recipientOrSource : "Customer";
                                                        } else if (!destinationDisplay || destinationDisplay.toLowerCase() === "store") {
                                                            destinationDisplay = "Shop Floor";
                                                        } else if (!destinationDisplay.toLowerCase().includes("shop floor")) {
                                                            destinationDisplay = `Shop Floor (${destinationDisplay})`;
                                                        }

                                                        let purposeDisplay = tx.purpose || tx.transactionCategory || 'Outward Issue';
                                                        if (isQCRejection) {
                                                            purposeDisplay = tx.purpose || 'Quality Control Rejection / Scrap';
                                                        } else if (isJobWork) {
                                                            purposeDisplay = tx.purpose || `Job Work Outward (DC: ${tx.referenceDocNumber || 'JWC'})`;
                                                        } else if (tx.referenceDocType === "MaterialIssue" || tx.transactionCategory?.includes("MATERIAL_ISSUE")) {
                                                            if (purposeDisplay.toLowerCase().includes("issue to shop floor")) {
                                                                // already has prefix
                                                            } else if (purposeDisplay.toLowerCase().includes("demand for mrp")) {
                                                                purposeDisplay = `Issue to Shop Floor (${purposeDisplay})`;
                                                            } else {
                                                                purposeDisplay = `Issue to Shop Floor — ${purposeDisplay}`;
                                                            }
                                                        }

                                                        return (
                                                            <tr key={tx._id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                                                                isQCRejection ? 'bg-rose-50/40 dark:bg-rose-950/20' : ''
                                                            }`}>
                                                                <td className="px-4 py-3 font-mono text-gray-600 dark:text-gray-300">
                                                                    {new Date(tx.timestamp || tx.createdAt).toLocaleDateString()}
                                                                </td>
                                                                <td className="px-4 py-3 font-semibold text-rose-600 dark:text-rose-400 font-mono">
                                                                    {tx.referenceDocNumber || 'N/A'}
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <span className={`font-semibold ${
                                                                        isQCRejection
                                                                            ? "text-rose-700 dark:text-rose-300"
                                                                            : isJobWork 
                                                                                ? "text-purple-700 dark:text-purple-300" 
                                                                                : isSales 
                                                                                    ? "text-blue-700 dark:text-blue-300" 
                                                                                    : "text-amber-700 dark:text-amber-300"
                                                                    }`}>
                                                                        {destinationDisplay}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3 text-right font-bold text-rose-600">
                                                                    -{Math.abs(tx.quantity)} {tx.unit || item.unit}
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    {isQCRejection ? (
                                                                        <div className="space-y-0.5">
                                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800 inline-block">
                                                                                QC REJECTED
                                                                            </span>
                                                                            <span className="block text-[11px] text-rose-600 font-medium">
                                                                                {purposeDisplay}
                                                                            </span>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/50">
                                                                            {purposeDisplay}
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3 font-bold text-rose-600 dark:text-rose-300">
                                                                    {tx.performedByName || tx.performedBy?.name || tx.performedBy?.username || 'Store Admin'}
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
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

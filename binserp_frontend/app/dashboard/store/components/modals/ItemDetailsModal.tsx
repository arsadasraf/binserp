import React, { useEffect, useState } from 'react';
import { X, Download, Package, Calendar, MapPin, Hash, Factory, Edit2 } from 'lucide-react';
import { apiGet, apiPost } from '@/src/lib/api'; // Adjust path if needed
import LoadingSpinner from '@/src/components/LoadingSpinner'; // Adjust path
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ItemDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: any; // The inventory item object
    type: 'bo' | 'inhouse';
}

export default function ItemDetailsModal({ isOpen, onClose, item, type }: ItemDetailsModalProps) {
    const [history, setHistory] = useState<any[]>([]);
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
        setEditingStockValue(displayOpeningStock !== null ? displayOpeningStock : (item.monthlyData?.openingStock || 0));
    };

    const handleOpeningStockSave = async () => {
        setIsUpdating(true);
        try {
            const token = localStorage.getItem('token');
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
        } catch (error) {
            console.error("Failed to update opening stock", error);
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
        }
    }, [isOpen, item, type]);

    const fetchHistory = async () => {
        setLoading(true);
        setError('');
        try {
            // Determine correct ID for history fetch
            // For BO (Inventory), we need the Material ID, not the Inventory Record ID
            // For InHouse (Component), the item itself is the Component, so _id is correct
            let targetId = item._id;

            if (type === 'bo') {
                // Check if materialId exists (it should per schema)
                if (item.materialId) {
                    targetId = typeof item.materialId === 'object' ? item.materialId._id : item.materialId;
                } else {
                    console.warn("Inventory item missing materialId:", item);
                    // Fallback to item._id? Unlikely to work if GRN links to Material, but technically possible if DB is messy.
                    // Let's stick to materialId and maybe log error if missing.
                }
            }

            console.log(`Fetching history for ${type} item. Target ID: ${targetId} (Original ID: ${item._id})`);

            const endpoint = `/api/store/grn/history/${type}/${targetId}`;
            const result = await apiGet(endpoint, token);
            setHistory(result.grns || []);
        } catch (err: any) {
            console.error("Failed to fetch history:", err);
            setError("Failed to load history.");
        } finally {
            setLoading(false);
        }
    };

    // Helper to get the correct ID for comparison across PDF and Modal view
    const targetId = item && (type === 'bo'
        ? (item.materialId ? (typeof item.materialId === 'object' ? item.materialId._id : item.materialId) : item._id)
        : item._id);

    const downloadPDF = () => {
        const doc = new jsPDF();

        // Title
        doc.setFontSize(18);
        doc.text(`Item Details: ${item?.materialName || item?.componentName}`, 14, 20);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 28);

        // Item Info Table
        autoTable(doc, {
            startY: 35,
            head: [['Field', 'Value']],
            body: [
                ['Code', item?.materialCode || item?.componentCode || item?.code || '-'],
                ['Name', item?.materialName || item?.componentName || item?.name || '-'],
                ['Item Type', type === 'bo' ? 'Bought Out' : 'In-House'],
                ['Current Stock', `${type === 'bo' ? item?.currentStock : item?.quantity} ${item?.unit || ''}`],
                [type === 'bo' ? 'Category' : 'Type', type === 'bo' ? (item?.categoryId?.name || item?.category?.name || item?.category || '-') : (item?.type || '-')],
                ['Location', item?.locationId?.name || item?.location?.name || item?.location || '-'],
            ],
            theme: 'striped',
            headStyles: { fillColor: [79, 70, 229] }, // Indigo-600
        });

        // GRN History Title
        const finalY = (doc as any).lastAutoTable.finalY || 40;
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text("Last 5 GRN History", 14, finalY + 15);

        // GRN History Table
        const historyRows = history.map(grn => {
            // Find specific item quantity in this GRN
            // GRN items structure: { material: id, component: id, quantity: x ... }
            const grnItem = grn.items?.find((i: any) =>
                (type === 'bo' && (i.material?._id === targetId || i.material === targetId)) ||
                (type === 'inhouse' && (i.component?._id === targetId || i.component === targetId || i.fgItem?._id === targetId || i.fgItem === targetId))
            );

            const rowData = [
                new Date(grn.date).toLocaleDateString(),
                grn.grnNumber,
                ...(type === 'bo' ? [grn.supplier?.name || 'N/A'] : []),
                grnItem ? `${grnItem.quantity || grnItem.receivedQuantity} ${grnItem.unit || ''}` : '-',
                grnItem ? (grnItem.acceptedQuantity || 0) : '-',
                grnItem ? (grnItem.rejectedQuantity || 0) : '-',
                grn.qcStatus || 'N/A'
            ];
            return rowData;
        });

        autoTable(doc, {
            startY: finalY + 20,
            head: [['Date', 'GRN No.', ...(type === 'bo' ? ['Supplier'] : []), 'Rcv Qty', 'Acc Qty', 'Rej Qty', 'QC Status']],
            body: historyRows.length > 0 ? historyRows : [['No history found', '-', '-', '-', '-', '-']],
            theme: 'grid',
            headStyles: { fillColor: [37, 99, 235] }, // Blue-600
        });

        doc.save(`Item_History_${item?.materialCode || 'details'}.pdf`);
    };

    if (!isOpen || !item) return null;

    const itemName = item.materialName || item.componentName || item.name;
    const itemCode = item.materialCode || item.componentCode || item.code;
    const stock = type === 'bo' ? item.currentStock : item.quantity;
    const categoryName = item.categoryId?.name || item.category?.name || item.category || '-';
    const locationName = item.locationId?.name || item.location?.name || item.location || '-';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full lg:min-w-screen max-w-3xl max-h-[120vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 mb-1">
                            {type === 'bo' ? <Package size={16} /> : <Factory size={16} />}
                            {type === 'bo' ? 'Inventory Item' : 'FG Item'}
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{itemName}</h2>
                        <span className="text-sm text-gray-500 font-mono">{itemCode}</span>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* Key Details Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                            <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold block mb-1">Stock</span>
                            <span className={`text-lg font-bold ${stock <= (item.reorderLevel || 0) ? 'text-red-600' : 'text-green-600'}`}>
                                {stock} <span className="text-sm text-gray-500 font-normal">{item.unit}</span>
                            </span>
                            {item.monthlyData && (
                                <div className="mt-1 flex items-center gap-1 text-xs group">
                                    <span className="text-gray-500 font-medium">Opening:</span>
                                    {editingStock ? (
                                        <div className="flex items-center gap-1">
                                            <input 
                                                type="number" 
                                                value={editingStockValue} 
                                                onChange={(e) => setEditingStockValue(Number(e.target.value))}
                                                className="w-16 px-1 py-0.5 border rounded text-xs text-gray-900"
                                                onKeyDown={(e) => e.key === 'Enter' && handleOpeningStockSave()}
                                                autoFocus
                                            />
                                            <button onClick={handleOpeningStockSave} disabled={isUpdating} className="px-1.5 py-0.5 bg-indigo-600 text-white rounded text-[10px]">Save</button>
                                            <button onClick={() => setEditingStock(false)} className="px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded text-[10px]">X</button>
                                        </div>
                                    ) : (
                                        <>
                                            <span className="font-bold text-gray-900 dark:text-gray-200">
                                                {displayOpeningStock !== null ? displayOpeningStock : item.monthlyData.openingStock}
                                            </span>
                                            <button 
                                                onClick={handleOpeningStockEditClick}
                                                className="p-1 text-gray-400 hover:text-indigo-600 rounded hover:bg-indigo-50 transition-colors opacity-60 group-hover:opacity-100"
                                                title="Edit opening stock"
                                            >
                                                <Edit2 size={12} />
                                            </button>
                                        </>
                                    )}
                                    <span className="text-green-600 font-medium ml-1">(+{item.monthlyData.totalInwardQuantity})</span>
                                    <span className="text-red-600 font-medium">(-{item.monthlyData.totalOutwardQuantity})</span>
                                </div>
                            )}
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                            <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold block mb-1">
                                {type === 'bo' ? 'Category' : 'Type'}
                            </span>
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-200 truncate block" title={type === 'bo' ? categoryName : item.type}>
                                {type === 'bo' ? categoryName : (item.type || '-')}
                            </span>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                            <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold block mb-1">Location</span>
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-200 flex items-center gap-1 truncate" title={locationName}>
                                <MapPin size={12} className="text-gray-400" /> {locationName}
                            </span>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                            <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold block mb-1">Last Updated</span>
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-200">
                                {new Date(item.updatedAt || new Date()).toLocaleDateString()}
                            </span>
                        </div>
                    </div>

                    {/* GRN History Section */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                <Calendar size={18} className="text-gray-500" />
                                Recent GRN History
                            </h3>
                            <button
                                onClick={downloadPDF}
                                disabled={history.length === 0}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Download size={16} />
                                Export PDF
                            </button>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                            {loading ? (
                                <div className="p-8 flex justify-center"><LoadingSpinner /></div>
                            ) : error ? (
                                <div className="p-8 text-center text-red-500">{error}</div>
                            ) : history.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">No GRN history found for this item.</div>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                                            {/* Hide GRN No on Mobile */}
                                            <th className="hidden md:table-cell px-4 py-3 text-left font-medium text-gray-500">GRN No</th>
                                            {type === 'bo' && <th className="px-4 py-3 text-left font-medium text-gray-500">Supplier</th>}
                                            <th className="px-4 py-3 text-center font-medium text-gray-500">Rcv</th>
                                            <th className="px-4 py-3 text-center font-medium text-gray-500">Acc</th>
                                            <th className="px-4 py-3 text-center font-medium text-gray-500">Rej</th>
                                            <th className="px-4 py-3 text-left font-medium text-gray-500">QC Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                        {history.map((grn) => {
                                            const grnItem = grn.items?.find((i: any) =>
                                                (type === 'bo' && (i.material?._id === targetId || i.material === targetId)) ||
                                                (type === 'inhouse' && (i.component?._id === targetId || i.component === targetId || i.fgItem?._id === targetId || i.fgItem === targetId))
                                            );
                                            return (
                                                <tr key={grn._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100">
                                                        {new Date(grn.date).toLocaleDateString()}
                                                    </td>
                                                    {/* Hide GRN No on Mobile */}
                                                    <td className="hidden md:table-cell px-4 py-3 text-indigo-600 dark:text-indigo-400 font-medium">
                                                        {grn.grnNumber}
                                                    </td>
                                                    {type === 'bo' && (
                                                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                                                            {grn.supplier?.name || 'N/A'}
                                                        </td>
                                                    )}
                                                    <td className="px-4 py-3 text-center font-medium text-gray-900 dark:text-gray-100">
                                                        {grnItem ? (grnItem.quantity || grnItem.receivedQuantity) : '-'}
                                                    </td>
                                                    <td className="px-4 py-3 text-center font-medium text-green-600">
                                                        {grnItem ? (grnItem.acceptedQuantity || 0) : '-'}
                                                    </td>
                                                    <td className="px-4 py-3 text-center font-bold text-red-600">
                                                        {grnItem && grnItem.rejectedQuantity > 0 ? grnItem.rejectedQuantity : '-'}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${grn.qcStatus === 'Completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                            grn.qcStatus === 'Pending' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                                                                grn.qcStatus === 'Partial' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                                    'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                                                            }`}>
                                                            {grn.qcStatus || 'N/A'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>

                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

"use client";

import React, { useState, useEffect } from 'react';
import { X, Download, Package, Layers, Settings, Calendar, Clock, Cog } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { API_BASE_URL } from '@/src/utils/config';

interface ProductDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: any;
    orderQuantity?: number; // Optional scaling factor
}

export default function ProductDetailsModal({ isOpen, onClose, item: initialItem, orderQuantity = 1 }: ProductDetailsModalProps) {
    const [activeTab, setActiveTab] = useState<'overview' | 'bom' | 'routing'>('overview');
    const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
    const [item, setItem] = useState<any>(initialItem);
    const [loading, setLoading] = useState(false);

    // Sync state with props and fetch details
    useEffect(() => {
        if (isOpen) {
            setItem(initialItem); // Reset to initial to show something immediately
            if (initialItem?._id) {
                fetchFullDetails(initialItem._id);
            }
        }
    }, [isOpen, initialItem?._id]); // Only re-run if ID changes or modal opens

    const fetchFullDetails = async (id: string) => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/api/ppc/component/${id}`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                setItem((prev: any) => ({ ...prev, ...data })); // Merge to preserve any existing UI state if needed
            }
        } catch (err) {
            console.error("Failed to fetch product details", err);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !item) return null;

    // Helper to aggregate BOM from Routing
    const getAggregatedBOM = () => {
        const bomMap = new Map();
        if (item.routing && Array.isArray(item.routing)) {
            item.routing.forEach((step: any) => {
                if (step.requiredItems && Array.isArray(step.requiredItems)) {
                    step.requiredItems.forEach((ri: any) => {
                        const key = ri.item || ri.itemName; // Use ID or Name as key
                        const qty = (Number(ri.quantity) || 0) * (orderQuantity || 1); // Scale by Order Quantity

                        if (bomMap.has(key)) {
                            const existing = bomMap.get(key);
                            existing.quantity += qty;
                        } else {
                            bomMap.set(key, { ...ri, quantity: qty });
                        }
                    });
                }
            });
        }
        return Array.from(bomMap.values());
    };

    const aggregatedBOM = getAggregatedBOM();

    const downloadPDF = () => {
        const doc = new jsPDF();

        // Header
        doc.setFontSize(18);
        doc.text(`Product Details: ${item.componentName}`, 14, 20);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Type: ${item.type || 'Component'}`, 14, 28);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 34);

        let finalY = 40;

        // 1. Overview Section
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text("Overview", 14, finalY);

        autoTable(doc, {
            startY: finalY + 5,
            head: [['Field', 'Value']],
            body: [
                ['Name', item.componentName],
                ['Description', item.description || '-'],
                ['Type', item.type || 'Component'],
                ['Unit', item.unit || 'Nos'],
                ['Inventory Item', item.isInventoryItem ? 'Yes' : 'No'],
            ],
            theme: 'striped',
            headStyles: { fillColor: [79, 70, 229] }, // Indigo-600
        });

        finalY = (doc as any).lastAutoTable.finalY + 15;

        // 2. BOM Section (Aggregated)
        if (aggregatedBOM.length > 0) {
            doc.text("Bill of Materials (Consolidated)", 14, finalY);

            const bomRows = aggregatedBOM.map((b: any) => {
                let source = 'Component';
                if (b.itemModel === 'Material' || b.sourceType === 'Store-Bo') source = 'RM (Bo)';
                else source = 'Inhouse';

                return [
                    source,
                    b.itemName || b.item?.name || '-',
                    `${b.quantity} ${b.unit || ''}`
                ];
            });

            autoTable(doc, {
                startY: finalY + 5,
                head: [['Source', 'Item', 'Total Qty']],
                body: bomRows,
                theme: 'grid',
                headStyles: { fillColor: [37, 99, 235] }, // Blue-600
            });

            finalY = (doc as any).lastAutoTable.finalY + 15;
        }

        // 3. Process/Routing Section
        if (item.routing && item.routing.length > 0) {

            // Check if we need a new page
            if (finalY > 250) {
                doc.addPage();
                finalY = 20;
            }

            doc.text("Process Flow (Routing)", 14, finalY);

            const routingRows = item.routing.map((r: any, idx: number) => {
                // Format Input Materials for the table
                let inputsStr = '-';
                if (r.requiredItems && r.requiredItems.length > 0) {
                    inputsStr = r.requiredItems.map((ri: any) =>
                        `${ri.itemName || ri.item?.name} (${ri.quantity} ${ri.unit})`
                    ).join('\n');
                }

                return [
                    idx + 1,
                    r.processName || r.process?.processName || '-',
                    r.machine?.machineName || '-',
                    inputsStr, // Added Inputs Column
                    `${r.standardTime} min`,
                    r.isOutsourced ? 'Jobwork' : 'In-House', // New Type Column
                    r.qcRequired ? 'Yes' : 'No'
                ];
            });

            autoTable(doc, {
                startY: finalY + 5,
                head: [['#', 'Process', 'Machine', 'Input Materials', 'Time', 'Type', 'QC']],
                body: routingRows,
                theme: 'grid',
                headStyles: { fillColor: [16, 185, 129] }, // Emerald-500
                columnStyles: {
                    3: { cellWidth: 40, fontSize: 8 } // Wrap text for Inputs column
                }
            });
        }

        const filename = `${item.componentName || 'product'}_${item.description || ''}_details`.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        doc.save(`${filename}.pdf`);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className={`bg-white dark:bg-gray-900 md:rounded-2xl shadow-xl w-full max-w-4xl h-full md:h-auto md:max-h-[90vh] flex flex-col overflow-hidden ${loading ? 'opacity-80' : ''}`}>

                {/* Header */}
                <div className="p-4 md:p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-start bg-gray-50/50 dark:bg-gray-900/50 shrink-0">
                    <div>
                        <div className="flex items-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 mb-1">
                            <Layers size={16} />
                            {item.type || 'PPC Component'} Details
                            {loading && <span className="ml-2 text-xs text-gray-500 animate-pulse">(Updating...)</span>}
                        </div>
                        <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">{item.componentName}</h2>
                        <div className="flex items-center gap-3 mt-1">
                            {item.isInventoryItem && (
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Inventory Item</span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={downloadPDF}
                            className="hidden md:flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-sm shadow-indigo-200"
                        >
                            <Download size={18} />
                            Download PDF
                        </button>
                        <button
                            onClick={downloadPDF}
                            className="md:hidden p-2 text-indigo-600 bg-indigo-50 rounded-lg"
                        >
                            <Download size={20} />
                        </button>
                        <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="px-6 border-b border-gray-100 dark:border-gray-800 flex gap-6 shrink-0 overflow-x-auto">
                    {(['overview', 'bom', 'routing'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`py-3 text-sm font-medium border-b-2 transition-all capitalize whitespace-nowrap ${activeTab === tab
                                ? 'border-indigo-600 text-indigo-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            {tab === 'bom' ? 'Bill of Materials' : tab}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50/30 dark:bg-gray-900/30 pb-20 md:pb-6">

                    {/* OVERVIEW TAB */}
                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Basic Info Card */}
                                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <Package size={16} /> Basic Information
                                    </h3>
                                    <div className="space-y-3">
                                        <div className="flex justify-between py-2 border-b border-gray-50 dark:border-gray-700/50">
                                            <span className="text-gray-500">Description</span>
                                            <span className="font-medium text-gray-900 dark:text-gray-200">{item.description || '-'}</span>
                                        </div>
                                        <div className="flex justify-between py-2 border-b border-gray-50 dark:border-gray-700/50">
                                            <span className="text-gray-500">Unit</span>
                                            <span className="font-medium text-gray-900 dark:text-gray-200">{item.unit || 'Nos'}</span>
                                        </div>
                                        <div className="flex justify-between py-2 border-b border-gray-50 dark:border-gray-700/50">
                                            <span className="text-gray-500">Product Type</span>
                                            <span className="font-medium text-gray-900 dark:text-gray-200">{item.type || 'Component'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Stats Card */}
                                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <Settings size={16} /> Statistics
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                                            <span className="block text-2xl font-bold text-blue-600 dark:text-blue-400">{aggregatedBOM.length}</span>
                                            <span className="text-xs text-blue-500 font-medium">BOM Items</span>
                                        </div>
                                        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-center">
                                            <span className="block text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                                                {item.routing?.length || 0}
                                            </span>
                                            <span className="text-xs text-emerald-500 font-medium">Processes</span>
                                        </div>
                                        <div className="p-3 bg-violet-50 dark:bg-violet-900/20 rounded-lg text-center col-span-2">
                                            <span className="block text-2xl font-bold text-violet-600 dark:text-violet-400">
                                                {item.routing?.reduce((acc: number, r: any) => acc + (Number(r.standardTime) || 0), 0)} min
                                            </span>
                                            <span className="text-xs text-violet-500 font-medium">Total Cycle Time</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Photos Gallery */}
                            {item.photos && item.photos.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Product Photos</h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
                                        {item.photos.map((photo: string, idx: number) => (
                                            <div
                                                key={idx}
                                                className="aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200 cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all"
                                                onClick={() => setSelectedPhoto(photo)}
                                            >
                                                <img src={photo} alt={`Product ${idx + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}


                        </div>
                    )}

                    {/* BOM TAB */}
                    {activeTab === 'bom' && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                            {aggregatedBOM.length === 0 ? (
                                <div className="p-12 text-center text-gray-500">
                                    <Package size={48} className="mx-auto mb-4 text-gray-300" />
                                    <p>No Bill of Materials defined for this product.</p>
                                </div>
                            ) : (
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                                        <tr>
                                            <th className="px-6 py-3 font-semibold text-gray-600">Source</th>
                                            <th className="px-6 py-3 font-semibold text-gray-600">Item Name</th>
                                            <th className="px-6 py-3 font-semibold text-gray-600 text-right">Total Quantity</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                        {aggregatedBOM.map((bom: any, idx: number) => {
                                            // Determine Source Label & Style
                                            let sourceLabel = 'Inhouse';
                                            let badgeStyle = 'bg-blue-100 text-blue-800';

                                            if (bom.itemModel === 'Material' || bom.sourceType === 'Store-Bo') {
                                                sourceLabel = 'RM (Bo)';
                                                badgeStyle = 'bg-yellow-100 text-yellow-800';
                                            } else {
                                                sourceLabel = 'Inhouse';
                                                badgeStyle = 'bg-purple-100 text-purple-800';
                                            }

                                            return (
                                                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                                    <td className="px-6 py-3">
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badgeStyle}`}>
                                                            {sourceLabel}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-3 font-medium text-gray-900 dark:text-white">
                                                        {bom.itemName || bom.item?.name || '-'}
                                                    </td>
                                                    <td className="px-6 py-3 text-right text-gray-600">
                                                        {bom.quantity} <span className="text-secondary text-xs">{bom.unit}</span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}

                    {/* ROUTING TAB */}
                    {activeTab === 'routing' && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                            {(!item.routing || item.routing.length === 0) ? (
                                <div className="p-12 text-center text-gray-500">
                                    <Cog size={48} className="mx-auto mb-4 text-gray-300" />
                                    <p>No Process Flow (Routing) defined for this product.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {item.routing.map((step: any, idx: number) => (
                                        <div key={idx} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                            <div className="flex flex-col md:flex-row gap-6">

                                                {/* Left: Step Info */}
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <span className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm">
                                                            {idx + 1}
                                                        </span>
                                                        <h4 className="font-bold text-lg text-gray-900 dark:text-white">
                                                            {step.processName || step.process?.processName}
                                                        </h4>
                                                        {step.isOutsourced ? (
                                                            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Jobwork</span>
                                                        ) : (
                                                            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider">In-House</span>
                                                        )}
                                                        {step.qcRequired && (
                                                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-medium">QC</span>
                                                        )}
                                                    </div>

                                                    <div className="ml-11">
                                                        <p className="text-sm text-gray-500 mb-4 flex items-center gap-2">
                                                            <Cog size={14} /> Machine: {step.machine?.machineName || 'Manual / No Machine'}
                                                            <span className="mx-2 text-gray-300">|</span>
                                                            <Clock size={14} /> Time: {step.standardTime} min
                                                        </p>

                                                        {step.description && (
                                                            <p className="text-sm text-gray-600 dark:text-gray-400 italic mb-4 bg-gray-50 dark:bg-gray-800/50 p-2 rounded">
                                                                "{step.description}"
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Right: Inputs & Photos */}
                                                <div className="flex-1 space-y-4">

                                                    {/* Required Items */}
                                                    <div>
                                                        <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Input Materials</h5>
                                                        {step.requiredItems && step.requiredItems.length > 0 ? (
                                                            <div className="bg-gray-50 dark:bg-gray-900/30 rounded-lg border border-gray-100 dark:border-gray-800 text-sm overflow-hidden">
                                                                <table className="w-full text-left">
                                                                    <tbody className="divide-y divide-gray-200/50 dark:divide-gray-700/50">
                                                                        {step.requiredItems.map((ri: any, riIdx: number) => (
                                                                            <tr key={riIdx}>
                                                                                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                                                                                    {ri.itemName || ri.item?.name}
                                                                                </td>
                                                                                <td className="px-3 py-2 text-right font-medium text-gray-900 dark:text-white">
                                                                                    {ri.quantity} <span className="text-xs text-gray-500">{ri.unit}</span>
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        ) : (
                                                            <p className="text-sm text-gray-400 italic">No input materials required.</p>
                                                        )}
                                                    </div>

                                                    {/* Step Photos */}
                                                    {step.photos && step.photos.length > 0 && (
                                                        <div>
                                                            <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Process Photos</h5>
                                                            <div className="flex gap-2 overflow-x-auto pb-2">
                                                                {step.photos.map((photo: string, pIdx: number) => (
                                                                    <div
                                                                        key={pIdx}
                                                                        className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden border border-gray-200 cursor-pointer hover:ring-2 hover:ring-indigo-500"
                                                                        onClick={() => setSelectedPhoto(photo)}
                                                                    >
                                                                        <img src={photo} alt="Step Process" className="w-full h-full object-cover" />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Lightbox Modal (Global) */}
            {selectedPhoto && (
                <div
                    className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200"
                    onClick={() => setSelectedPhoto(null)}
                >
                    <button
                        className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                        onClick={() => setSelectedPhoto(null)}
                    >
                        <X size={32} />
                    </button>
                    <img
                        src={selectedPhoto}
                        alt="Full screen view"
                        className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
}

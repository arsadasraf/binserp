/**
 * MastersTable Component
 */

import React, { useState, useMemo } from 'react';
import { Edit2, Trash2, Download, FileText, Camera, IndianRupee, ArrowLeft, ChevronLeft, ChevronRight, Search, Image as ImageIcon } from 'lucide-react';
import { MasterType } from '../../types/store.types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import GRNDetailModal from '../modals/GRNDetailModal';
import MasterDetailModal from '../modals/MasterDetailModal';
import ColumnFilter from './ColumnFilter';

interface MastersTableProps {
    data: any[];
    masterTab: MasterType;
    onEdit: (item: any) => void;
    onDelete: (id: string) => void;
}

const isWithin12Hours = (createdAt: string | Date): boolean => {
    const now = new Date().getTime();
    const created = new Date(createdAt).getTime();
    const hoursDiff = (now - created) / (1000 * 60 * 60);
    return hoursDiff <= 12;
};





const downloadGRNAsPDF = (grn: any) => {
    try {
        console.log('Generating PDF for GRN:', grn);
        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text('Goods Receipt Note', 105, 20, { align: 'center' } as any);

        doc.setFontSize(11);
        doc.text(`GRN Number: ${grn.grnNumber}`, 20, 35);
        doc.text(`Date: ${new Date(grn.date).toLocaleDateString()}`, 20, 42);
        doc.text(`Supplier: ${grn.supplierName || 'N/A'}`, 20, 49);
        doc.text(`Status: ${grn.status}`, 20, 56);

        const tableData = (grn.items || []).map((item: any) => [
            item.materialName || 'N/A',
            String(item.quantity || 0),
            item.unit || 'PCS',
            String(item.acceptedQuantity || item.receivedQuantity || item.quantity || 0),
            String(item.rejectedQuantity || 0),
        ]);

        console.log('Table data prepared:', tableData);

        autoTable(doc, {
            startY: 65,
            head: [['Material', 'Quantity', 'Unit', 'Accepted', 'Rejected']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [79, 70, 229] },
            styles: { fontSize: 10 }
        });

        const finalY = (doc as any).lastAutoTable?.finalY || 100;
        doc.setFontSize(9);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 105, finalY + 15, { align: 'center' } as any);

        const filename = `GRN_${grn.grnNumber.replace(/\//g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        console.log('Saving PDF:', filename);
        doc.save(filename);

        console.log('PDF generated successfully');
    } catch (error) {
        console.error('PDF Error:', error);
        console.error('Error details:', (error as any)?.message);
        alert(`PDF Error: ${(error as any)?.message}. Check console.`);
    }
};

const downloadGRNAsExcel = (grn: any) => {
    const grnDetails = [
        ['Goods Receipt Note'],
        [],
        ['GRN Number:', grn.grnNumber],
        ['Date:', new Date(grn.date).toLocaleDateString()],
        ['Supplier:', grn.supplierName || 'N/A'],
        ['Status:', grn.status],
        [],
        ['Material', 'Quantity', 'Unit', 'Accepted Qty', 'Rejected Qty'],
    ];

    (grn.items || []).forEach((item: any) => {
        grnDetails.push([
            item.materialName || 'N/A',
            item.quantity || 0,
            item.unit || 'PCS',
            item.acceptedQuantity || item.receivedQuantity || item.quantity || 0,
            item.rejectedQuantity || 0,
        ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(grnDetails);
    worksheet['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 15 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'GRN');
    XLSX.writeFile(workbook, `GRN_${grn.grnNumber}_${new Date().toISOString().split('T')[0]}.xlsx`);
};

const downloadPOAsPDF = (po: any) => {
    try {
        console.log('Generating PDF for PO:', po);
        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text('Purchase Order', 105, 20, { align: 'center' } as any);

        doc.setFontSize(11);
        doc.text(`PO Number: ${po.poNumber}`, 20, 35);
        doc.text(`Date: ${new Date(po.date).toLocaleDateString()}`, 20, 42);
        doc.text(`Vendor: ${po.vendorName || po.vendor?.name || 'N/A'}`, 20, 49);
        doc.text(`Status: ${po.status}`, 20, 56);

        // Handle both single material and items array
        const items = po.items && po.items.length > 0 ? po.items : [{
            materialName: po.materialName,
            quantity: po.quantity,
            unit: po.unit,
            rate: po.rate,
            amount: po.amount
        }];

        const tableData = items.map((item: any) => [
            item.materialName || 'N/A',
            String(item.quantity || 0),
            item.unit || 'PCS',
            String(item.rate || 0),
            String(item.amount || 0),
        ]);

        console.log('Table data prepared:', tableData);

        autoTable(doc, {
            startY: 65,
            head: [['Material', 'Quantity', 'Unit', 'Rate (₹)', 'Amount (₹)']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [147, 51, 234] }, // Purple for PO
            styles: { fontSize: 10 }
        });

        const finalY = (doc as any).lastAutoTable?.finalY || 100;
        doc.setFontSize(11);
        doc.text(`Total Amount: ₹ ${(po.totalAmount || po.amount || 0).toFixed(2)}`, 20, finalY + 10);

        doc.setFontSize(9);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 105, finalY + 20, { align: 'center' } as any);

        const filename = `PO_${po.poNumber.replace(/\//g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        console.log('Saving PDF:', filename);
        doc.save(filename);

        console.log('PDF generated successfully');
    } catch (error) {
        console.error('PDF Error:', error);
        console.error('Error details:', (error as any)?.message);
        alert(`PDF Error: ${(error as any)?.message}. Check console.`);
    }
};

const downloadPOAsExcel = (po: any) => {
    const poDetails = [
        ['Purchase Order'],
        [],
        ['PO Number:', po.poNumber],
        ['Date:', new Date(po.date).toLocaleDateString()],
        ['Vendor:', po.vendorName || po.vendor?.name || 'N/A'],
        ['Status:', po.status],
        [],
        ['Material', 'Quantity', 'Unit', 'Rate (₹)', 'Amount (₹)'],
    ];

    // Handle both single material and items array
    const items = po.items && po.items.length > 0 ? po.items : [{
        materialName: po.materialName,
        quantity: po.quantity,
        unit: po.unit,
        rate: po.rate,
        amount: po.amount
    }];

    items.forEach((item: any) => {
        poDetails.push([
            item.materialName || 'N/A',
            item.quantity || 0,
            item.unit || 'PCS',
            item.rate || 0,
            item.amount || 0,
        ]);
    });

    poDetails.push([]);
    poDetails.push(['Total Amount:', '', '', '', po.totalAmount || po.amount || 0]);

    const worksheet = XLSX.utils.aoa_to_sheet(poDetails);
    worksheet['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 15 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'PO');
    XLSX.writeFile(workbook, `PO_${po.poNumber}_${new Date().toISOString().split('T')[0]}.xlsx`);
};

export default function MastersTable({ data, masterTab, onEdit, onDelete }: MastersTableProps) {
    const [filters, setFilters] = useState<Record<string, string[]>>({});

    const handleFilterChange = (column: string, values: string[]) => {
        setFilters(prev => ({
            ...prev,
            [column]: values
        }));
    };

    const [searchTerm, setSearchTerm] = useState('');

    const filteredData = useMemo(() => {
        let result = data;

        if (masterTab === 'po-history' && Object.keys(filters).length === 0 && !searchTerm) {
            return result;
        }

        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            result = result.filter(item => 
                (item.name?.toLowerCase().includes(lowerSearch)) || 
                (item.code?.toLowerCase().includes(lowerSearch)) ||
                (item.componentName?.toLowerCase().includes(lowerSearch)) ||
                (item.contactPerson?.toLowerCase().includes(lowerSearch))
            );
        }

        result = result.filter(item => {
            return Object.entries(filters).every(([key, selectedValues]) => {
                if (selectedValues.length === 0) return true;

                let itemValue = '';
                if (key === 'supplierName') {
                    itemValue = item.supplierName || '-';
                } else if (key === 'status') {
                    itemValue = item.status || '-';
                } else if (key === 'material') {
                    itemValue = item.items?.[0]?.materialName || item.items?.[0]?.itemName || '-';
                } else if (key === 'qcStatus') {
                    itemValue = item.qcStatus || 'N/A';
                } else if (key === 'customerType') {
                    itemValue = item.customerType || '-';
                } else if (key === 'vendorType') {
                    itemValue = item.vendorType || '-';
                } else {
                    itemValue = String(item[key] || '');
                }

                return selectedValues.includes(itemValue);
            });
        });

        return result;
    }, [data, filters, searchTerm, masterTab]);

    const [selectedGRN, setSelectedGRN] = useState<any>(null);
    const [selectedMasterItem, setSelectedMasterItem] = useState<any>(null); // State for master detail
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isMasterDetailOpen, setIsMasterDetailOpen] = useState(false); // State for master detail modal
    const [viewingPhotos, setViewingPhotos] = useState<string[] | null>(null);
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);

    const scroll = (direction: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            const { current } = scrollContainerRef;
            const scrollAmount = current.clientWidth; // Scroll one full width
            current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
        }
    };

    const handleRowClick = (item: any) => {
        if ((masterTab === "grn-history" || masterTab === "fg-grn-history")) {
            setSelectedGRN(item);
            setIsDetailModalOpen(true);
        } else if (["vendor", "customer", "fg-items"].includes(masterTab)) {
            setSelectedMasterItem(item);
            setIsMasterDetailOpen(true);
        }
    };

    const exportToPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(14);
        doc.text(`${masterTab.toUpperCase()} List`, 14, 15);
        
        let head = [];
        let body = [];

        if (masterTab === 'customer' || masterTab === 'vendor') {
            head = [['Name', 'Code', 'Contact', 'Email', 'Type']];
            body = filteredData.map(item => [
                item.name || '-', 
                item.code || '-', 
                item.contactPerson || '-', 
                item.email || '-', 
                masterTab === 'customer' ? (item.customerType || '-') : (item.vendorType || '-')
            ]);
        } else {
             head = [['Name', 'Code']];
             body = filteredData.map(item => [
                 item.name || item.componentName || '-', 
                 item.code || '-'
             ]);
        }

        autoTable(doc, {
            startY: 25,
            head: head,
            body: body,
            theme: 'grid',
            headStyles: { fillColor: [63, 81, 181] },
        });

        doc.save(`${masterTab}_list_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const exportToExcel = () => {
        if ((masterTab === 'grn-history' || masterTab === 'fg-grn-history')) {
            const exportData = filteredData.map(item => ({
                'GRN Number': item.grnNumber,
                'Date': new Date(item.date).toLocaleDateString(),
                'Supplier': item.supplierName || '-',
                'Material': item.items?.[0]?.materialName || '-',
                'Quantity': `${item.items?.[0]?.quantity || 0} ${item.items?.[0]?.unit || ''}`,
                'Total': (item.items?.reduce((sum: number, i: any) => sum + ((i.rate || 0) * (i.quantity || 0)), 0) || 0).toFixed(2),
                'QC Status': item.qcStatus || 'N/A'
            }));
            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'GRN History');
            XLSX.writeFile(wb, `GRN_History_${new Date().toISOString().split('T')[0]}.xlsx`);
        } else {
            let exportData = [];
            if (masterTab === 'customer' || masterTab === 'vendor') {
                exportData = filteredData.map(item => ({
                    'Name': item.name || '-',
                    'Code': item.code || '-',
                    'Contact': item.contactPerson || '-',
                    'Email': item.email || '-',
                    'Type': masterTab === 'customer' ? (item.customerType || '-') : (item.vendorType || '-'),
                    'Billing Address': item.billingAddress || item.address || '-',
                    'Billing City': item.billingCity || item.city || '-',
                    'Shipping Address': item.shippingAddress || '-',
                    'GST': item.gst || '-',
                }));
            } else {
                exportData = filteredData.map(item => ({
                    'Name': item.name || item.componentName || '-',
                    'Code': item.code || '-'
                }));
            }
            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, `${masterTab} List`);
            XLSX.writeFile(wb, `${masterTab}_list_${new Date().toISOString().split('T')[0]}.xlsx`);
        }
    };

    return (
        <div className="w-full">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-4 p-4 bg-white rounded-xl shadow-sm border border-gray-200 gap-4">
                <div className="flex items-center gap-4 w-full sm:w-auto flex-1">
                    <span className="text-sm text-gray-500 font-medium whitespace-nowrap">
                        Showing {filteredData.length} records
                    </span>
                    {["vendor", "customer", "job-work-supplier", "rm-bo-item", "fg-items", "category", "location"].includes(masterTab) && (
                        <div className="relative w-full sm:max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search by name or code..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                            />
                        </div>
                    )}
                </div>
                
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    {masterTab !== 'po-history' && (
                        <button
                            onClick={exportToExcel}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors border border-green-200"
                            title="Export to Excel"
                        >
                            <Download size={16} />
                            Excel
                        </button>
                    )}
                    {(masterTab !== 'grn-history' && masterTab !== 'fg-grn-history') && masterTab !== 'po-history' && (
                        <button
                            onClick={exportToPDF}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-200"
                            title="Export to PDF"
                        >
                            <FileText size={16} />
                            PDF
                        </button>
                    )}
                </div>
            </div>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            {(masterTab !== "grn-history" && masterTab !== "fg-grn-history") && masterTab !== "po-history" && (<>
                                {(masterTab === 'rm-bo-item' || masterTab === 'fg-items') && <th className="px-6 py-3 text-left font-semibold text-gray-900 w-24">Photo</th>}
                                <th className="px-6 py-3 text-left font-semibold text-gray-900">Name</th>
                                {masterTab !== 'fg-items' && masterTab !== 'rm-bo-item' && <th className="px-6 py-3 text-left font-semibold text-gray-900">Code</th>}
                                {masterTab === 'fg-items' && <th className="px-6 py-3 text-left font-semibold text-gray-900">Description</th>}
                            </>)}
                            {(masterTab === "grn-history" || masterTab === "fg-grn-history") && (
                                <>
                                    <th className="px-6 py-3 text-left font-semibold text-gray-900">GRN Number</th>
                                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Date</th>
                                    {masterTab === 'grn-history' && (
                                        <th className="px-6 py-3 text-left">
                                            <ColumnFilter
                                                column="supplierName"
                                                title="Supplier"
                                                data={data}
                                                currentFilters={filters['supplierName'] || []}
                                                onFilterChange={(vals) => handleFilterChange('supplierName', vals)}
                                            />
                                        </th>
                                    )}
                                    <th className="px-6 py-3 text-left">
                                        <ColumnFilter
                                            column="material"
                                            title="Item"
                                            data={data}
                                            currentFilters={filters['material'] || []}
                                            onFilterChange={(vals) => handleFilterChange('material', vals)}
                                            getValue={(item) => item.items?.[0]?.materialName || item.items?.[0]?.itemName || '-'}
                                        />
                                    </th>
                                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Quantity</th>
                                    <th className="px-6 py-3 text-right font-semibold text-gray-900">Total</th>
                                    <th className="px-6 py-3 text-left">
                                        <ColumnFilter
                                            column="qcStatus"
                                            title="QC Status"
                                            data={data}
                                            currentFilters={filters['qcStatus'] || []}
                                            onFilterChange={(vals) => handleFilterChange('qcStatus', vals)}
                                        />
                                    </th>
                                </>
                            )}
                            {masterTab === "po-history" && (<><th className="px-6 py-3 text-left font-semibold text-gray-900">PO Number</th><th className="px-6 py-3 text-left font-semibold text-gray-900">Date</th><th className="px-6 py-3 text-left font-semibold text-gray-900">Vendor</th><th className="px-6 py-3 text-left font-semibold text-gray-900">Material</th><th className="px-6 py-3 text-left font-semibold text-gray-900">Amount (₹)</th><th className="px-6 py-3 text-left font-semibold text-gray-900">Status</th></>)}
                            {(masterTab === "vendor" || masterTab === "customer") && (<><th className="px-6 py-3 text-left font-semibold text-gray-900">Contact</th><th className="px-6 py-3 text-left font-semibold text-gray-900">Email</th></>)}
                            {(masterTab === "customer" || masterTab === "vendor") && (
                                <th className="px-6 py-3 text-left font-semibold text-gray-900">
                                    <ColumnFilter
                                        column={masterTab === "customer" ? "customerType" : "vendorType"}
                                        title="Type"
                                        data={data}
                                        currentFilters={filters[masterTab === "customer" ? 'customerType' : 'vendorType'] || []}
                                        onFilterChange={(vals) => handleFilterChange(masterTab === "customer" ? 'customerType' : 'vendorType', vals)}
                                    />
                                </th>
                            )}
                            {masterTab === "location" && <th className="px-6 py-3 text-left font-semibold text-gray-900">Description</th>}
                            {masterTab === "category" && <><th className="px-6 py-3 text-left font-semibold text-gray-900">HSN Code</th><th className="px-6 py-3 text-left font-semibold text-gray-900">Unit</th></>}
                            {masterTab === "rm-bo-item" && (<><th className="px-6 py-3 text-left font-semibold text-gray-900">Description</th><th className="px-6 py-3 text-left font-semibold text-gray-900">Min Stock</th><th className="px-6 py-3 text-left font-semibold text-gray-900">Unit</th><th className="px-6 py-3 text-left font-semibold text-gray-900">Category</th><th className="px-6 py-3 text-left font-semibold text-gray-900">Location</th></>)}
                            {masterTab === "fg-items" && (
                                <>
                                    <th className="px-6 py-3 text-left font-semibold text-gray-900">
                                        <ColumnFilter
                                            column="type"
                                            title="Type"
                                            data={data}
                                            currentFilters={filters['type'] || []}
                                            onFilterChange={(vals) => handleFilterChange('type', vals)}
                                        />
                                    </th>
                                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Unit</th>
                                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Location</th>
                                </>
                            )}
                            <th className="px-6 py-3 text-right font-semibold text-gray-900">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {filteredData.map((item) => (
                            <tr
                                key={item._id}
                                className={`transition-colors ${((masterTab === "grn-history" || masterTab === "fg-grn-history") || ["vendor", "customer"].includes(masterTab))
                                    ? 'hover:bg-indigo-50 cursor-pointer'
                                    : 'hover:bg-gray-50'
                                    }`}
                                onClick={() => handleRowClick(item)}
                            >
                                {(masterTab === "grn-history" || masterTab === "fg-grn-history") && (
                                    <>
                                        <td className="px-6 py-4 font-medium text-gray-900">{item.grnNumber}</td>
                                        <td className="px-6 py-4 text-gray-600">{new Date(item.date).toLocaleDateString()}</td>
                                        {masterTab === 'grn-history' && (
                                            <td className="px-6 py-4 text-gray-600">{item.supplierName || '-'}</td>
                                        )}
                                        <td className="px-6 py-4 text-gray-600">{(item.items?.[0]?.materialName || item.items?.[0]?.itemName || '-')}{item.items?.length > 1 && <span className="text-xs text-gray-500 ml-1">(+{item.items.length - 1} more)</span>}</td>
                                        <td className="px-6 py-4 text-gray-600">{item.items?.[0]?.quantity} {item.items?.[0]?.unit}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-1.5 text-gray-900 font-semibold">
                                                <IndianRupee size={16} className="text-green-600" />
                                                <span>₹{(() => {
                                                    const total = item.items?.reduce((sum: number, i: any) => sum + ((i.rate || 0) * (i.quantity || 0)), 0) || 0;
                                                    console.log('GRN:', item.grnNumber, 'Total:', total, 'Items:', item.items);
                                                    return total.toFixed(2);
                                                })()}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4"><span className={`px-2 py-1 rounded-full text-xs font-medium ${item.qcStatus === 'Completed' ? 'bg-green-100 text-green-800' : item.qcStatus === 'Pending' ? 'bg-orange-100 text-orange-800' : item.qcStatus === 'Partial' ? 'bg-blue-100 text-blue-800' : item.qcStatus === 'Skipped' ? 'bg-gray-100 text-gray-800' : 'bg-gray-100 text-gray-800'}`}>{item.qcStatus || 'N/A'}</span></td>
                                    </>
                                )}
                                {masterTab === "po-history" && (
                                    <>
                                        <td className="px-6 py-4 font-medium text-gray-900">{item.poNumber}</td>
                                        <td className="px-6 py-4 text-gray-600">{new Date(item.date).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 text-gray-600">{item.vendorName || item.vendor?.name || '-'}</td>
                                        <td className="px-6 py-4 text-gray-600">{(item.items && item.items.length > 0 ? item.items[0]?.materialName : item.materialName) || '-'}{item.items?.length > 1 && <span className="text-xs text-gray-500 ml-1">(+{item.items.length - 1} more)</span>}</td>
                                        <td className="px-6 py-4 text-gray-600 font-semibold">₹ {(item.totalAmount || item.amount || 0).toFixed(2)}</td>
                                        <td className="px-6 py-4"><span className={`px-2 py-1 rounded-full text-xs font-medium ${item.status === 'Released' ? 'bg-purple-100 text-purple-800' : item.status === 'Completed' ? 'bg-green-100 text-green-800' : item.status === 'Cancelled' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>{item.status}</span></td>
                                    </>
                                )}
                                {(masterTab !== "grn-history" && masterTab !== "fg-grn-history") && masterTab !== "po-history" && (
                                    <>
                                        {(masterTab === 'rm-bo-item' || masterTab === 'fg-items') && (
                                            <td className="px-6 py-4">
                                                {item.photos && item.photos.length > 0 ? (
                                                    <div 
                                                        className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center cursor-pointer hover:bg-indigo-100 transition-colors relative shadow-sm border border-indigo-100" 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setViewingPhotos(item.photos);
                                                        }}
                                                        title="View Photos"
                                                    >
                                                        <ImageIcon size={16} />
                                                        {item.photos.length > 1 && (
                                                            <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold h-4 w-4 flex items-center justify-center rounded-full shadow-sm">
                                                                {item.photos.length}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                                                        <Camera size={14} className="text-gray-400" />
                                                    </div>
                                                )}
                                            </td>
                                        )}
                                        <td className="px-6 py-4 font-medium text-gray-900">{item.name}</td>
                                        {masterTab !== "fg-items" && masterTab !== "rm-bo-item" && <td className="px-6 py-4 text-gray-600">{item.code}</td>}
                                        {masterTab === "fg-items" && <td className="px-6 py-4 text-gray-600">{item.description || '-'}</td>}
                                        {masterTab === "location" && <td className="px-6 py-4 text-gray-600">{item.description || '-'}</td>}
                                        {masterTab === "category" && <><td className="px-6 py-4 text-gray-600">{item.hsnCode || '-'}</td><td className="px-6 py-4 text-gray-600">{item.unit || '-'}</td></>}

                                        {(masterTab === "vendor" || masterTab === "customer") && (<><td className="px-6 py-4 text-gray-600">{item.contactPerson}</td><td className="px-6 py-4 text-gray-600">{item.email}</td></>)}
                                        {(masterTab === "customer" || masterTab === "vendor") && <td className="px-6 py-4 text-gray-600">{masterTab === "customer" ? (item.customerType || '-') : (item.vendorType || '-')}</td>}
                                        {masterTab === "rm-bo-item" && (<><td className="px-6 py-4 text-gray-600">{item.descriptions || '-'}</td><td className="px-6 py-4 text-gray-600">{item.minimumStock ?? '-'}</td><td className="px-6 py-4 text-gray-600">{item.categoryId?.unit || item.category?.unit || item.unit || '-'}</td><td className="px-6 py-4 text-gray-600">{item.categoryId?.name || item.category?.name || '-'}</td><td className="px-6 py-4 text-gray-600">{item.locationId?.name || item.location?.name || '-'}</td></>)}
                                        {masterTab === "fg-items" && (
                                            <>
                                                <td className="px-6 py-4 text-gray-600">
                                                    {item.type || '-'}
                                                </td>
                                                <td className="px-6 py-4 text-gray-600">{item.unit || '-'}</td>
                                                <td className="px-6 py-4 text-gray-600">
                                                    {item.location?.name || item.locationId?.name || (typeof item.location === 'string' ? item.location : '') || '-'}
                                                </td>
                                            </>
                                        )}
                                    </>
                                )}
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                        {(masterTab === "grn-history" || masterTab === "fg-grn-history") ? (
                                            <>
                                                {item.pdf && (
                                                    <a href={item.pdf} download className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Download PDF">
                                                        <FileText size={16} />
                                                    </a>
                                                )}
                                                {item.photos && item.photos.length > 0 && (
                                                    <button onClick={(e) => {
                                                        e.stopPropagation(); // Prevent row click
                                                        setViewingPhotos(item.photos);
                                                    }} className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="View Photos">
                                                        <Camera size={16} />
                                                    </button>
                                                )}
                                                {isWithin12Hours(item.createdAt || item.date) ? (
                                                    <>
                                                        <button onClick={() => onEdit(item)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit GRN"><Edit2 size={16} /></button>
                                                        <button onClick={() => onDelete(item._id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete GRN"><Trash2 size={16} /></button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button disabled className="p-2 text-gray-400 cursor-not-allowed rounded-lg" title="Cannot edit: 12-hour limit exceeded"><Edit2 size={16} /></button>
                                                        <button disabled className="p-2 text-gray-400 cursor-not-allowed rounded-lg" title="Cannot delete: 12-hour limit exceeded"><Trash2 size={16} /></button>
                                                    </>
                                                )}
                                            </>
                                        ) : masterTab === "po-history" ? (
                                            <>
                                                <button onClick={() => downloadPOAsPDF(item)} className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Download PDF"><Download size={16} /></button>
                                                {isWithin12Hours(item.createdAt || item.date) ? (
                                                    <>
                                                        <button onClick={() => onEdit(item)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit PO"><Edit2 size={16} /></button>
                                                        <button onClick={() => onDelete(item._id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete PO"><Trash2 size={16} /></button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button disabled className="p-2 text-gray-400 cursor-not-allowed rounded-lg" title="Cannot edit: 12-hour limit exceeded"><Edit2 size={16} /></button>
                                                        <button disabled className="p-2 text-gray-400 cursor-not-allowed rounded-lg" title="Cannot delete: 12-hour limit exceeded"><Trash2 size={16} /></button>
                                                    </>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <button onClick={() => onEdit(item)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit"><Edit2 size={16} /></button>
                                                <button onClick={() => onDelete(item._id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 size={16} /></button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden flex flex-col gap-3 p-4">
                {filteredData.map((item) => (
                    <div
                        key={item._id}
                        onClick={() => handleRowClick(item)}
                        className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-3 active:scale-[0.98] transition-transform"
                    >
                        {/* Card Header */}
                        <div className="flex justify-between items-start border-b border-gray-50 pb-2">
                            <div>
                                {(masterTab === "grn-history" || masterTab === "fg-grn-history") ? (
                                    <>
                                        <span className="text-xs font-medium text-gray-500 block mb-1">GRN #{item.grnNumber}</span>
                                        <h4 className="font-bold text-gray-900">{item.supplierName}</h4>
                                    </>
                                ) : masterTab === "po-history" ? (
                                    <>
                                        <span className="text-xs font-medium text-gray-500 block mb-1">PO #{item.poNumber}</span>
                                        <h4 className="font-bold text-gray-900">{item.vendorName || item.vendor?.name || 'Unknown Vendor'}</h4>
                                    </>
                                ) : (
                                    <>
                                        {masterTab === 'rm-bo-item' && item.photos && item.photos.length > 0 && (
                                            <div 
                                                className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center cursor-pointer hover:bg-indigo-100 transition-colors relative shadow-sm border border-indigo-100 mb-2" 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setViewingPhotos(item.photos);
                                                }}
                                                title="View Photos"
                                            >
                                                <ImageIcon size={16} />
                                                {item.photos.length > 1 && (
                                                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold h-4 w-4 flex items-center justify-center rounded-full shadow-sm">
                                                        {item.photos.length}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                        <h4 className="font-bold text-gray-900">{item.name}</h4>
                                        {masterTab !== "fg-items" && masterTab !== "rm-bo-item" && <span className="text-xs text-gray-500">{item.code}</span>}
                                    </>
                                )}
                            </div>

                            {/* Status Badges for History Tabs */}
                            {(masterTab === "grn-history" || masterTab === "fg-grn-history") && (
                                <div className="flex flex-col gap-1 items-end">
                                    {item.qcStatus && (
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.qcStatus === 'Completed' ? 'bg-green-100 text-green-800' : item.qcStatus === 'Pending' ? 'bg-orange-100 text-orange-800' : item.qcStatus === 'Partial' ? 'bg-blue-100 text-blue-800' : item.qcStatus === 'Skipped' ? 'bg-gray-100 text-gray-800' : 'bg-gray-100 text-gray-800'}`}>QC: {item.qcStatus}</span>
                                    )}
                                </div>
                            )}
                            {masterTab === "po-history" && (
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.status === 'Released' ? 'bg-purple-100 text-purple-800' : item.status === 'Completed' ? 'bg-green-100 text-green-800' : item.status === 'Cancelled' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>{item.status}</span>
                            )}
                        </div>

                        {/* Card Content Details */}
                        <div className="text-sm space-y-2">
                            {(masterTab === "vendor" || masterTab === "customer") && (
                                <>
                                    <div className="flex justify-between"><span className="text-gray-500">Contact:</span> <span className="font-medium">{item.contactPerson || '-'}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-500">Email:</span> <span className="font-medium">{item.email || '-'}</span></div>
                                    {(masterTab === "customer" || masterTab === "vendor") && <div className="flex justify-between"><span className="text-gray-500">Type:</span> <span className="font-medium">{masterTab === "customer" ? (item.customerType || '-') : (item.vendorType || '-')}</span></div>}
                                 </>
                             )}
                             {masterTab === "location" && (
                                 <div className="flex justify-between"><span className="text-gray-500">Description:</span> <span className="font-medium">{item.description || '-'}</span></div>
                             )}

                            {masterTab === "category" && (
                                <>
                                    <div className="flex justify-between"><span className="text-gray-500">HSN Code:</span> <span className="font-medium">{item.hsnCode || '-'}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-500">Unit:</span> <span className="font-medium">{item.unit || '-'}</span></div>
                                </>
                            )}

                            {masterTab === "rm-bo-item" && (
                                <>
                                    <div className="flex justify-between"><span className="text-gray-500">Description:</span> <span className="font-medium">{item.descriptions || '-'}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-500">Min Stock:</span> <span className="font-medium">{item.minimumStock ?? '-'}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-500">Unit:</span> <span className="font-medium">{item.categoryId?.unit || item.category?.unit || item.unit || '-'}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-500">Category:</span> <span className="font-medium">{item.categoryId?.name || item.category?.name || '-'}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-500">Location:</span> <span className="font-medium">{item.locationId?.name || item.location?.name || '-'}</span></div>
                                </>
                            )}
                            {masterTab === "fg-items" && (
                                <>
                                    <div className="flex justify-between"><span className="text-gray-500">Description:</span> <span className="font-medium">{item.description || '-'}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-500">Type:</span> <span className="font-medium">{item.type || '-'}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-500">Unit:</span> <span className="font-medium">{item.unit || '-'}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-500">Location:</span> <span className="font-medium">{item.location?.name || '-'}</span></div>
                                </>
                            )}

                            {(masterTab === "grn-history" || masterTab === "fg-grn-history") && (
                                <>
                                    <div className="flex justify-between"><span className="text-gray-500">Date:</span> <span>{new Date(item.date).toLocaleDateString()}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-500">Items:</span> <span>{item.items?.length || 0}</span></div>
                                    <div className="flex justify-between items-center pt-1 border-t border-gray-100">
                                        <span className="text-gray-500">Total Amount:</span>
                                        <div className="flex items-center gap-1 font-bold text-green-600">
                                            <IndianRupee size={14} />
                                            <span>₹{(item.items?.reduce((sum: number, i: any) => sum + ((i.rate || 0) * (i.quantity || 0)), 0) || 0).toFixed(2)}</span>
                                        </div>
                                    </div>
                                </>
                            )}

                            {masterTab === "po-history" && (
                                <>
                                    <div className="flex justify-between"><span className="text-gray-500">Date:</span> <span>{new Date(item.date).toLocaleDateString()}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-500">Amount:</span> <span className="font-bold">₹ {(item.totalAmount || item.amount || 0).toFixed(2)}</span></div>
                                </>
                            )}
                        </div>

                        {/* Card Actions */}
                        <div className="flex items-center gap-2 pt-3 border-t border-gray-50 mt-1">
                            {(masterTab === "grn-history" || masterTab === "fg-grn-history") ? (
                                <div className="flex w-full gap-2">
                                    {item.pdf && (
                                        <a href={item.pdf} download className="flex-1 py-2 text-blue-600 bg-blue-50 rounded-lg text-xs font-medium flex justify-center items-center gap-1">
                                            <FileText size={14} /> PDF
                                        </a>
                                    )}
                                    {item.photos && item.photos.length > 0 && (
                                        <button onClick={(e) => {
                                            e.stopPropagation();
                                            setViewingPhotos(item.photos);
                                        }} className="flex-1 py-2 text-green-600 bg-green-50 rounded-lg text-xs font-medium flex justify-center items-center gap-1">
                                            <Camera size={14} /> View Photos ({item.photos.length})
                                        </button>
                                    )}
                                    {isWithin12Hours(item.createdAt || item.date) && (
                                        <button onClick={() => onDelete(item._id)} className="flex-none p-2 text-red-600 bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                                    )}
                                </div>
                            ) : masterTab === "po-history" ? (
                                <div className="flex w-full gap-2">
                                    <button onClick={() => downloadPOAsPDF(item)} className="flex-1 py-2 text-purple-600 bg-purple-50 rounded-lg text-xs font-medium flex justify-center items-center gap-1"><Download size={14} /> PDF</button>
                                    {isWithin12Hours(item.createdAt || item.date) && (
                                        <button onClick={() => onDelete(item._id)} className="flex-none p-2 text-red-600 bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <button onClick={() => onEdit(item)} className="flex-1 flex items-center justify-center gap-2 py-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg text-sm font-medium transition-colors"><Edit2 size={16} /> Edit</button>
                                    <button onClick={() => onDelete(item._id)} className="flex-1 flex items-center justify-center gap-2 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors"><Trash2 size={16} /> Delete</button>
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* GRN Detail Modal */}
            <GRNDetailModal
                grn={selectedGRN}
                isOpen={isDetailModalOpen}
                onClose={() => setIsDetailModalOpen(false)}
            />

            {/* Master Detail Modal */}
            <MasterDetailModal
                isOpen={isMasterDetailOpen}
                onClose={() => setIsMasterDetailOpen(false)}
                data={selectedMasterItem}
                type={masterTab}
            />

            {/* Full Screen Photo Viewer - Modern Mobile Style */}
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
                        <p className="text-white/50 text-xs absolute bottom-2">Swipe to view more</p>
                    </div>
                </div>
            )}
        </div>
    );
}

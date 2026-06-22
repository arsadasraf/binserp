import React, { useState, useEffect } from 'react';
import { Plus, Search, Factory, Calendar, Truck, CheckCircle2, FileText, FileSpreadsheet } from 'lucide-react';
import { JobWorkChallan, Vendor, JobWorkSupplier } from '../../types/store.types';
import JobWorkForm from '../forms/JobWorkForm';
import JobWorkReceiveModal from '../modals/JobWorkReceiveModal';

import { apiGet, apiDelete } from '@/src/lib/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface JobWorkStoreProps {
    vendors: Vendor[];
    jobWorkSuppliers?: JobWorkSupplier[];
    materials?: any[];
    inHouseItems?: any[];
    activeTab: string;
    token: string | null;
    onError: (msg: string) => void;
    onSuccess: (msg: string) => void;
}

export default function JobWorkStore({ vendors, jobWorkSuppliers = [], materials = [], inHouseItems = [], activeTab, token, onError, onSuccess }: JobWorkStoreProps) {
    const [challans, setChallans] = useState<JobWorkChallan[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    // User requested "Challan" tab. Replacing 'sent'/'create' with 'challan'.
    const [subTab, setSubTab] = useState<'challan' | 'pending' | 'received' | 'overdue'>('challan');

    // Filter States
    const [filterMonth, setFilterMonth] = useState('');
    const [filterDay, setFilterDay] = useState('');
    const [filterSupplier, setFilterSupplier] = useState('');

    // New State for Pending Jobs
    const [prefillData, setPrefillData] = useState<any>(null);

    // Modal States
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
    const [selectedChallan, setSelectedChallan] = useState<JobWorkChallan | null>(null);


    const fetchChallans = async () => {
        if (!token) return;
        try {
            setLoading(true);
            const data = await apiGet('/api/store/jobwork/all', token);
            setChallans(data.challans || []);
        } catch (error: any) {
            console.error(error);
            onError(error.message || 'Failed to load job work data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchChallans();
    }, [subTab]);

    const handleCreateSuccess = () => {
        setIsFormOpen(false);
        fetchChallans();
        onSuccess('Job Work Challan created successfully');
    };

    const handleReceiveSuccess = () => {
        setIsReceiveModalOpen(false);
        setSelectedChallan(null);
        fetchChallans();
        onSuccess('Items received successfully');
    };

    const openReceiveModal = (challan: JobWorkChallan) => {
        setSelectedChallan(challan);
        setIsReceiveModalOpen(true);
    };

    const handleCreateChallan = () => {
        setPrefillData(null);
        setIsFormOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this challan?')) return;
        try {
            await apiDelete(`/api/store/jobwork/delete/${id}`, token!);
            onSuccess('Challan deleted successfully');
            fetchChallans();
        } catch (error: any) {
            onError(error.message || 'Failed to delete challan');
        }
    };

    const exportChallanToPDF = (challan: JobWorkChallan) => {
        const doc = new jsPDF();
        const vendorName = challan.vendor?.name || 'Unknown Vendor';
        
        doc.setFontSize(20);
        doc.text("Job Work Challan", 14, 22);
        
        doc.setFontSize(12);
        doc.text(`Challan Number: ${challan.challanNumber}`, 14, 32);
        doc.text(`Date: ${new Date(challan.date).toLocaleDateString()}`, 14, 40);
        doc.text(`Supplier: ${vendorName}`, 14, 48);
        if (challan.expectedReturnDate) {
            doc.text(`Expected Return: ${new Date(challan.expectedReturnDate).toLocaleDateString()}`, 14, 56);
        }
        
        const tableColumn = ["Item Name", "Process Type", "Quantity Sent", "Unit", "Received"];
        const tableRows: any[] = [];
        
        challan.items.forEach(item => {
            tableRows.push([
                item.itemName || '-',
                item.processType || '-',
                item.quantitySent,
                item.unit || 'PCS',
                item.quantityReceived
            ]);
        });
        
        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 65,
        });
        
        doc.save(`JobWork_Challan_${challan.challanNumber}.pdf`);
    };

    const exportChallanToExcel = (challan: JobWorkChallan) => {
        const vendorName = challan.vendor?.name || 'Unknown Vendor';
        
        const exportData = challan.items.map(item => ({
            "Challan Number": challan.challanNumber,
            "Date": new Date(challan.date).toLocaleDateString(),
            "Supplier": vendorName,
            "Item Name": item.itemName || '-',
            "Process Type": item.processType || '-',
            "Quantity Sent": item.quantitySent,
            "Quantity Received": item.quantityReceived,
            "Pending": item.quantitySent - (item.quantityReceived || 0),
            "Unit": item.unit || 'PCS',
            "Status": item.status
        }));
        
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Challan");
        XLSX.writeFile(workbook, `JobWork_Challan_${challan.challanNumber}.xlsx`);
    };

    // Filter Logic
    const filteredChallans = challans.filter(c => {
        const matchesSearch =
            c.challanNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (c.vendor?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || false;

        if (!matchesSearch) return false;

        if (filterSupplier && c.vendor?._id !== filterSupplier) return false;
        if (filterMonth) {
            const challanMonth = new Date(c.date).toISOString().slice(0, 7); // YYYY-MM
            if (challanMonth !== filterMonth) return false;
        }
        if (filterDay) {
            const challanDay = new Date(c.date).toISOString().slice(0, 10); // YYYY-MM-DD
            if (challanDay !== filterDay) return false;
        }

        // "Challan" tab shows Active (Sent) challans, similar to old "sent".
        if (subTab === 'challan') return c.status !== 'Closed';

        if (subTab === 'pending') return c.status === 'Open' || c.status === 'Partial';
        if (subTab === 'received') return c.status === 'Closed' || c.status === 'Partial'; // Show history
        if (subTab === 'overdue') {
            if (c.status === 'Closed') return false;
            if (!c.expectedReturnDate) return false;
            return new Date(c.expectedReturnDate) < new Date();
        }
        return true;
    });

    return (
        <div className="animate-in fade-in duration-300">
            {/* Header: Tabs on Left, Action Button on Right */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                {/* Tabs */}
                <div className="flex bg-gray-100/80 p-1.5 rounded-xl backdrop-blur-sm overflow-x-auto self-start md:self-auto no-scrollbar">
                    <button
                        onClick={() => setSubTab('challan')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${subTab === 'challan'
                            ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5'
                            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                            }`}
                    >
                        Challans
                    </button>
                    <button
                        onClick={() => setSubTab('pending')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${subTab === 'pending'
                            ? 'bg-white text-amber-600 shadow-sm ring-1 ring-black/5'
                            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                            }`}
                    >
                        Pending Return
                    </button>
                    <button
                        onClick={() => setSubTab('received')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${subTab === 'received'
                            ? 'bg-white text-green-600 shadow-sm ring-1 ring-black/5'
                            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                            }`}
                    >
                        History / Received
                    </button>
                    <button
                        onClick={() => setSubTab('overdue')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${subTab === 'overdue'
                            ? 'bg-white text-red-600 shadow-sm ring-1 ring-black/5'
                            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                            }`}
                    >
                        Overdue
                    </button>
                </div>

                {/* Search & Create Button */}
                <div className="flex flex-wrap gap-3 w-full md:w-auto items-center">
                    {/* Filters */}
                    <select
                        value={filterSupplier}
                        onChange={(e) => setFilterSupplier(e.target.value)}
                        className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                        <option value="">All Suppliers</option>
                        {Array.from(new Set(challans.filter(c => c.vendor).map(c => c.vendor!._id))).map(id => {
                            const vendor = challans.find(c => c.vendor?._id === id)?.vendor;
                            if (!vendor) return null;
                            return <option key={vendor._id} value={vendor._id}>{vendor.name}</option>;
                        })}
                    </select>
                    <input
                        type="month"
                        value={filterMonth}
                        onChange={(e) => setFilterMonth(e.target.value)}
                        className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <input
                        type="date"
                        value={filterDay}
                        onChange={(e) => setFilterDay(e.target.value)}
                        className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />

                    <div className="relative flex-1 md:w-48">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search Challan..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                    </div>
                    <button
                        onClick={() => handleCreateChallan()}
                        className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                        <Plus size={16} />
                        Create New Challan
                    </button>
                </div>
            </div>


            {/* Content Logic */}
            {loading ? (
                <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>
            ) : filteredChallans.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <Truck className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                    <p className="text-gray-500">No job work items found</p>
                    {subTab === 'challan' && (
                        <div className="mt-4">
                            <button
                                onClick={() => handleCreateChallan()}
                                className="text-indigo-600 font-medium hover:underline"
                            >
                                Create your first challan
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {filteredChallans.map(challan => (
                        <div key={challan._id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex flex-col md:flex-row justify-between gap-4 mb-4 border-b border-gray-50 pb-3">
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <span className="font-bold text-gray-900">{challan.challanNumber}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${challan.status === 'Open' ? 'bg-blue-100 text-blue-800' :
                                            challan.status === 'Partial' ? 'bg-amber-100 text-amber-800' :
                                                challan.status === 'Closed' ? 'bg-green-100 text-green-800' :
                                                    'bg-red-100 text-red-800'
                                            }`}>{challan.status}</span>
                                    </div>
                                    <div className="text-sm text-gray-600 flex items-center gap-2">
                                        <Factory size={14} /> {challan.vendor?.name || 'Unknown Vendor'}
                                    </div>
                                </div>
                                <div className="text-right text-sm text-gray-500">
                                    <div className="flex items-center justify-end gap-1"><Calendar size={14} /> Sent: {new Date(challan.date).toLocaleDateString()}</div>
                                    {challan.expectedReturnDate && (
                                        <div className={`mt-1 font-medium ${new Date(challan.expectedReturnDate) < new Date() && challan.status !== 'Closed' ? 'text-red-500' : 'text-gray-500'}`}>
                                            Due: {new Date(challan.expectedReturnDate).toLocaleDateString()}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Items Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                                        <tr>
                                            <th className="px-3 py-2 text-left">Item</th>
                                            <th className="px-3 py-2 text-left">Process</th>
                                            <th className="px-3 py-2 text-center">Sent</th>
                                            <th className="px-3 py-2 text-center">Received</th>
                                            <th className="px-3 py-2 text-center">Pending</th>
                                            <th className="px-3 py-2 text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {challan.items.map((item, idx) => {
                                            const pending = item.quantitySent - item.quantityReceived;
                                            return (
                                                <tr key={idx}>
                                                    <td className="px-3 py-2 font-medium text-gray-900">{item.itemName}</td>
                                                    <td className="px-3 py-2 text-gray-600">{item.processType}</td>
                                                    <td className="px-3 py-2 text-center">{item.quantitySent} {item.unit}</td>
                                                    <td className="px-3 py-2 text-center text-green-600 font-medium">{item.quantityReceived}</td>
                                                    <td className="px-3 py-2 text-center text-amber-600 font-medium">{pending > 0 ? pending : '-'}</td>
                                                    <td className="px-3 py-2 text-right">
                                                        {item.status === 'Completed' ? <CheckCircle2 size={16} className="text-green-500 ml-auto" /> :
                                                            <span className="text-xs text-gray-500">{item.status}</span>}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Receive Timeline */}
                            {(challan as any).receiveHistory && (challan as any).receiveHistory.length > 0 && (
                                <div className="mt-3 bg-gray-50 rounded-lg p-3 text-xs">
                                    <h4 className="font-semibold text-gray-700 mb-2">Receive Timeline:</h4>
                                    <ul className="space-y-1">
                                        {(challan as any).receiveHistory.map((hist: any, i: number) => {
                                            const itemName = challan.items.find((it: any) => it._id === hist.itemId)?.itemName || 'Unknown Item';
                                            return (
                                                <li key={i} className="text-gray-600 flex gap-2">
                                                    <span className="text-gray-400">{new Date(hist.date).toLocaleString()}</span>
                                                    <span>-</span>
                                                    <span className="font-medium text-gray-800">{hist.quantity}</span>
                                                    <span>x {itemName}</span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
                                <div className="flex gap-2">
                                    {challan.status !== 'Partial' && challan.status !== 'Closed' && (
                                        <>
                                            <button onClick={() => { setPrefillData(challan); setIsFormOpen(true); }} className="px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 rounded hover:bg-indigo-100 transition-colors">Edit</button>
                                            <button onClick={() => handleDelete(challan._id)} className="px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded hover:bg-red-100 transition-colors">Delete</button>
                                        </>
                                    )}
                                    <button onClick={() => exportChallanToPDF(challan)} className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors flex items-center gap-1" title="Download PDF"><FileText size={16}/></button>
                                    <button onClick={() => exportChallanToExcel(challan)} className="px-3 py-1.5 text-sm font-medium text-green-600 bg-green-50 rounded hover:bg-green-100 transition-colors flex items-center gap-1" title="Download Excel"><FileSpreadsheet size={16}/></button>
                                </div>
                                {challan.status !== 'Closed' && (
                                    <button
                                        onClick={() => openReceiveModal(challan)}
                                        className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-black transition-colors flex items-center gap-2"
                                    >
                                        <Truck size={16} /> Mark Received / Return
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Forms & Modals */}
            <JobWorkForm
                isOpen={isFormOpen}
                isModal={true}
                onClose={() => setIsFormOpen(false)}
                onSuccess={handleCreateSuccess}
                onError={onError}
                vendors={vendors}
                jobWorkSuppliers={jobWorkSuppliers}
                materials={materials}
                inHouseItems={inHouseItems}
                initialData={prefillData}
                token={token}
            />

            {/* Modals */}

            {isReceiveModalOpen && selectedChallan && (
                <JobWorkReceiveModal
                    isOpen={isReceiveModalOpen}
                    onClose={() => setIsReceiveModalOpen(false)}
                    onSuccess={handleReceiveSuccess}
                    onError={onError}
                    challan={selectedChallan}
                    token={token}
                />
            )}
        </div>
    );
}

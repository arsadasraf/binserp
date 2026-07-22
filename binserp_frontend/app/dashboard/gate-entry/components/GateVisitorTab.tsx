"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import Webcam from 'react-webcam';
import { Eye, Clock, Search, ExternalLink, Calendar, LogIn, LogOut, CheckCircle2, User, Plus, Save, Camera, X, Building, MapPin, Users, History, Activity, FileText } from 'lucide-react';
import { API_BASE_URL } from '@/src/utils/config';
import ColumnFilter from '../../store/components/tables/ColumnFilter';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import { useHeader } from '@/src/context/HeaderContext';

export default function GateVisitorTab() {
    const { setShowBottomNav } = useHeader();
    const [visitors, setVisitors] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState<Record<string, string[]>>({});

    const handleFilterChange = (column: string, values: string[]) => {
        setFilters(prev => ({
            ...prev,
            [column]: values
        }));
    };

    // View Mode: 'active' | 'history'
    const [viewMode, setViewMode] = useState<'active' | 'history'>('active');
    const [historyFilterType, setHistoryFilterType] = useState<'daywise' | 'monthwise'>('daywise');
    const [historyDate, setHistoryDate] = useState(new Date().toISOString().split('T')[0]); // YYYY-MM-DD
    const [historyMonth, setHistoryMonth] = useState(() => {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
    });

    // Selected Visitor for Details Modal
    const [selectedVisitor, setSelectedVisitor] = useState<any>(null);

    // Modal State
    const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
    const [entryLoading, setEntryLoading] = useState(false);

    // --- Entry Form State ---
    const [visitorName, setVisitorName] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [whomToMeet, setWhomToMeet] = useState('');
    const [purpose, setPurpose] = useState('');
    const [address, setAddress] = useState('');
    const [phone, setPhone] = useState('');
    const [vehicleNumber, setVehicleNumber] = useState('');
    const [visitorPhoto, setVisitorPhoto] = useState<string | null>(null);
    const [vehiclePhoto, setVehiclePhoto] = useState<string | null>(null);

    // Webcam
    const webcamRef = useRef<Webcam>(null);
    const [captureMode, setCaptureMode] = useState<'visitor' | null>(null);

    // Load Visitors
    const loadVisitors = useCallback(async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            let url = `${API_BASE_URL}/api/visitor/active`;
            let params = {};

            if (viewMode === 'history') {
                url = `${API_BASE_URL}/api/visitor`; // Get all (filtered)
                
                if (historyFilterType === 'daywise') {
                    const start = new Date(historyDate);
                    start.setHours(0, 0, 0, 0);
                    const end = new Date(historyDate);
                    end.setHours(23, 59, 59, 999);
                    params = { start: start.toISOString(), end: end.toISOString() };
                } else {
                    const [year, month] = historyMonth.split('-');
                    const start = new Date(parseInt(year), parseInt(month) - 1, 1);
                    const end = new Date(parseInt(year), parseInt(month), 0); // Last day of month
                    end.setHours(23, 59, 59, 999);
                    params = { start: start.toISOString(), end: end.toISOString() };
                }
            }

            const res = await axios.get(url, {
                headers: { Authorization: `Bearer ${token}` },
                params
            });
            setVisitors(res.data.visitors);
        } catch (error) {
            console.error("Load visitors failed", error);
        } finally {
            setLoading(false);
        }
    }, [viewMode, historyDate, historyFilterType, historyMonth]);

    useEffect(() => {
        loadVisitors();
    }, [loadVisitors]);

    useEffect(() => {
        if (isEntryModalOpen || captureMode !== null || selectedVisitor !== null) {
            setShowBottomNav(false);
        } else {
            setShowBottomNav(true);
        }
        return () => setShowBottomNav(true);
    }, [isEntryModalOpen, captureMode, selectedVisitor, setShowBottomNav]);

    // Checkout
    const handleCheckOut = async (id: string) => {
        if (!confirm("Confirm Check Out?")) return;
        try {
            setCheckoutLoading(id);
            const token = localStorage.getItem('token');
            await axios.put(`${API_BASE_URL}/api/visitor/${id}/checkout`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // If in active view, remove from list. If history, reload to update status.
            if (viewMode === 'active') {
                setVisitors(prev => prev.filter(v => v._id !== id));
            } else {
                loadVisitors();
            }

        } catch (error) {
            console.error("Checkout failed", error);
            alert("Failed to check out.");
        } finally {
            setCheckoutLoading(null);
        }
    };

    // Capture Photo
    const capture = useCallback(() => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc) {
            if (captureMode === 'visitor') setVisitorPhoto(imageSrc);
            setCaptureMode(null); // Close camera modal
        }
    }, [webcamRef, captureMode]);

    // Submit Entry
    const handleCheckIn = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!visitorName || !phone || !whomToMeet || !purpose || !visitorPhoto) {
            alert("Please fill all required fields:\n- Name\n- Phone\n- Whom to Meet\n- Purpose\n- Visitor Photo");
            return;
        }

        try {
            setEntryLoading(true);
            const token = localStorage.getItem('token');
            await axios.post(`${API_BASE_URL}/api/visitor`, {
                name: visitorName,
                companyName,
                phone,
                whomToMeet,
                purpose,
                address,
                visitorPhoto
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            alert("Visitor Checked In Successfully!");
            // Reset form
            setVisitorName('');
            setCompanyName('');
            setPhone('');
            setWhomToMeet('');
            setPurpose('');
            setAddress('');
            setVisitorPhoto(null);
            setIsEntryModalOpen(false);

            // Refresh list
            loadVisitors();
        } catch (error) {
            console.error("Check-in failed", error);
            alert("Failed to check in visitor.");
        } finally {
            setEntryLoading(false);
        }
    };

    const filteredVisitors = visitors.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.phone.includes(searchTerm) ||
            (item.whomToMeet && item.whomToMeet.toLowerCase().includes(searchTerm.toLowerCase()));

        if (!matchesSearch) return false;

        return Object.entries(filters).every(([key, selectedValues]) => {
            if (selectedValues.length === 0) return true;
            
            let itemValue = '';
            if (key === 'company') {
                itemValue = item.companyName || '-';
            } else {
                itemValue = String(item[key] || '-');
            }
            
            return selectedValues.includes(itemValue);
        });
    });

    const downloadIDCard = (visitor: any) => {
        import('jspdf').then(({ jsPDF }) => {
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: [54, 86]
            });

            // Background
            doc.setFillColor(240, 248, 255); // Alice blue
            doc.rect(0, 0, 54, 86, 'F');

            // Header banner
            doc.setFillColor(79, 70, 229); // Indigo 600
            doc.rect(0, 0, 54, 12, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text("VISITOR PASS", 27, 8, { align: 'center' });

            // Photo
            if (visitor.visitorPhoto && visitor.visitorPhoto.startsWith('data:image')) {
                try {
                    doc.addImage(visitor.visitorPhoto, 'JPEG', 15, 15, 24, 24);
                    doc.setDrawColor(79, 70, 229);
                    doc.setLineWidth(0.5);
                    doc.rect(15, 15, 24, 24, 'S');
                } catch (e) {
                    console.error("Failed to add image to PDF", e);
                }
            } else {
                // Placeholder
                doc.setDrawColor(200, 200, 200);
                doc.setFillColor(220, 220, 220);
                doc.rect(15, 15, 24, 24, 'FD');
                doc.setTextColor(150, 150, 150);
                doc.setFontSize(8);
                doc.text("No Photo", 27, 27, { align: 'center' });
            }

            // Visitor Info
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text(visitor.name || "Unknown", 27, 44, { align: 'center' });

            if (visitor.companyName) {
                doc.setFontSize(7);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(100, 100, 100);
                doc.text(visitor.companyName, 27, 48, { align: 'center' });
            }

            // Details
            doc.setFontSize(7);
            doc.setTextColor(0, 0, 0);
            doc.setFont("helvetica", "bold");
            
            let y = 56;
            
            doc.text("Phone:", 5, y);
            doc.setFont("helvetica", "normal");
            doc.text(visitor.phone || "N/A", 20, y);
            
            y += 5;
            doc.setFont("helvetica", "bold");
            doc.text("To Meet:", 5, y);
            doc.setFont("helvetica", "normal");
            doc.text(visitor.whomToMeet || "N/A", 20, y);
            
            y += 5;
            doc.setFont("helvetica", "bold");
            doc.text("Purpose:", 5, y);
            doc.setFont("helvetica", "normal");
            doc.text(visitor.purpose || "N/A", 20, y);

            y += 5;
            doc.setFont("helvetica", "bold");
            doc.text("Check-In:", 5, y);
            doc.setFont("helvetica", "normal");
            const checkInStr = new Date(visitor.checkInTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
            doc.text(checkInStr, 20, y);

            // Footer
            doc.setDrawColor(200, 200, 200);
            doc.line(0, 77, 54, 77);
            
            doc.setFontSize(5);
            doc.setTextColor(150, 150, 150);
            doc.text("Please return this pass at the gate before leaving.", 27, 81, { align: 'center' });

            doc.save(`Visitor-Pass-${(visitor.name || 'Unknown').replace(/\s+/g, '-')}.pdf`);
        });
    };

    return (
        <div className="space-y-4 md:space-y-6 -mt-2 md:mt-0">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-slate-800 p-3 md:p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 gap-4">

                {/* Left: Title & Toggles */}
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="flex bg-gray-100 dark:bg-slate-700 p-1 rounded-lg w-full">
                        <button
                            onClick={() => setViewMode('active')}
                            className={`flex-1 md:flex-none md:px-6 py-3 rounded-md text-sm font-semibold flex justify-center items-center gap-2 transition-all ${viewMode === 'active' ? 'bg-white dark:bg-slate-800 shadow text-blue-600' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300'}`}
                        >
                            <Activity size={16} /> Active
                        </button>
                        <button
                            onClick={() => setViewMode('history')}
                            className={`flex-1 md:flex-none md:px-6 py-3 rounded-md text-sm font-semibold flex justify-center items-center gap-2 transition-all ${viewMode === 'history' ? 'bg-white dark:bg-slate-800 shadow text-blue-600' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300'}`}
                        >
                            <History size={16} /> History
                        </button>
                    </div>
                </div>

                {/* Right: Controls & Search */}
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">

                    {viewMode === 'history' && (
                        <>
                            {/* Filter Type Toggle */}
                            <div className="bg-gray-100 dark:bg-slate-700 flex p-1 rounded-lg">
                                <button
                                    onClick={() => setHistoryFilterType("monthwise")}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${historyFilterType === "monthwise"
                                        ? "bg-white text-gray-800 dark:bg-slate-800 dark:text-white shadow-sm"
                                        : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                        }`}
                                >
                                    Monthly
                                </button>
                                <button
                                    onClick={() => setHistoryFilterType("daywise")}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${historyFilterType === "daywise"
                                        ? "bg-white text-gray-800 dark:bg-slate-800 dark:text-white shadow-sm"
                                        : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                        }`}
                                >
                                    Daily
                                </button>
                            </div>

                            {/* Date/Month Picker */}
                            {historyFilterType === "monthwise" ? (
                                <input
                                    type="month"
                                    value={historyMonth}
                                    onChange={(e) => setHistoryMonth(e.target.value)}
                                    className="border border-gray-200 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 px-3 py-2 rounded-lg shadow-sm text-sm"
                                />
                            ) : (
                                <input
                                    type="date"
                                    value={historyDate}
                                    onChange={(e) => setHistoryDate(e.target.value)}
                                    className="border border-gray-200 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 px-3 py-2 rounded-lg shadow-sm text-sm"
                                />
                            )}
                        </>
                    )}

                    <div className="relative hidden md:block flex-1 md:flex-none">
                        <Search className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500" size={18} />
                        <input
                            type="text"
                            placeholder="Search visitor..."
                            className="pl-10 pr-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none w-full md:w-64 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {viewMode === 'active' && (
                        <button
                            onClick={() => setIsEntryModalOpen(true)}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors whitespace-nowrap shadow-sm hover:shadow-md"
                        >
                            <User size={18} /> New Visitor
                        </button>
                    )}
                </div>
            </div>

            {/* Mobile View: Cards */}
            <div className="grid grid-cols-1 gap-4 animate-in fade-in md:hidden">
                {loading ? <div className="text-center py-12"><LoadingSpinner /></div> : filteredVisitors.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-dashed">
                        {searchTerm ? 'No visitors found matching search.' : (viewMode === 'active' ? 'No active visitors currently inside.' : 'No visitor history for this date.')}
                    </div>
                ) : (
                    filteredVisitors.map((v) => (
                        <div
                            key={v._id}
                            onClick={() => setSelectedVisitor(v)}
                            className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border p-4 cursor-pointer hover:shadow-md transition-all group ${v.status === 'Left' ? 'border-gray-100 dark:border-slate-700 opacity-80' : 'border-blue-100 ring-1 ring-blue-50'}`}
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white line-clamp-1">{v.name}</h3>
                                    {v.companyName && <div className="text-xs font-semibold text-blue-600 mt-0.5 flex items-center gap-1"><Building size={10} /> {v.companyName}</div>}
                                </div>
                                <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${v.status === 'Inside' ? 'bg-green-100 text-green-700' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 '}`}>
                                    {v.status}
                                </div>
                            </div>

                            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400 ">
                                <div className="flex items-center gap-2 text-xs"><Users size={12} className="text-gray-400" /> To Meet: <span className="font-medium text-gray-900 dark:text-white ">{v.whomToMeet}</span></div>
                                <div className="flex items-center gap-2 text-xs"><Activity size={12} className="text-gray-400" /> Purpose: <span className="font-medium text-gray-900 dark:text-white ">{v.purpose}</span></div>
                                <div className="flex items-center justify-between text-xs text-gray-400 mt-2 pt-2 border-t border-gray-50 dark:border-slate-700">
                                    <div className="flex items-center gap-1.5">
                                        <History size={12} /> IN: {new Date(v.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                    {v.checkOutTime && (
                                        <div className="flex items-center gap-1.5 text-orange-500">
                                            <LogOut size={12} /> OUT: {new Date(v.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Desktop View: Table */}
            <div className="hidden md:block bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden animate-in fade-in">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600 dark:text-gray-400">
                        <thead className="bg-gray-50 dark:bg-slate-900/50 text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-slate-700">
                            <tr>
                                <th className="px-4 py-3 align-top">
                                    <ColumnFilter
                                        column="name"
                                        title="Visitor Name"
                                        data={visitors}
                                        currentFilters={filters['name'] || []}
                                        onFilterChange={(vals) => handleFilterChange('name', vals)}
                                    />
                                </th>
                                <th className="px-4 py-3 align-top">
                                    <ColumnFilter
                                        column="company"
                                        title="Company"
                                        data={visitors}
                                        currentFilters={filters['company'] || []}
                                        onFilterChange={(vals) => handleFilterChange('company', vals)}
                                        getValue={(item) => item.companyName || '-'}
                                    />
                                </th>
                                <th className="px-4 py-3 align-top">
                                    <ColumnFilter
                                        column="phone"
                                        title="Phone"
                                        data={visitors}
                                        currentFilters={filters['phone'] || []}
                                        onFilterChange={(vals) => handleFilterChange('phone', vals)}
                                    />
                                </th>
                                <th className="px-4 py-3 align-top">
                                    <ColumnFilter
                                        column="whomToMeet"
                                        title="To Meet"
                                        data={visitors}
                                        currentFilters={filters['whomToMeet'] || []}
                                        onFilterChange={(vals) => handleFilterChange('whomToMeet', vals)}
                                    />
                                </th>
                                <th className="px-4 py-3 align-top">
                                    <ColumnFilter
                                        column="purpose"
                                        title="Purpose"
                                        data={visitors}
                                        currentFilters={filters['purpose'] || []}
                                        onFilterChange={(vals) => handleFilterChange('purpose', vals)}
                                    />
                                </th>
                                <th className="px-4 py-3 align-top">
                                    <div className="font-bold mb-2">Check-In</div>
                                </th>
                                <th className="px-4 py-3 align-top">
                                    <div className="font-bold mb-2">Check-Out</div>
                                </th>
                                <th className="px-4 py-3 align-top">
                                    <ColumnFilter
                                        column="status"
                                        title="Status"
                                        data={visitors}
                                        currentFilters={filters['status'] || []}
                                        onFilterChange={(vals) => handleFilterChange('status', vals)}
                                    />
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-12"><LoadingSpinner /></td>
                                </tr>
                            ) : filteredVisitors.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-12 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-800/50 border-dashed">
                                        {searchTerm ? 'No visitors found matching search.' : (viewMode === 'active' ? 'No active visitors currently inside.' : 'No visitor history for this date.')}
                                    </td>
                                </tr>
                            ) : (
                                filteredVisitors.map((v) => (
                                    <tr 
                                        key={v._id} 
                                        onClick={() => setSelectedVisitor(v)}
                                        className={`hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors ${v.status === 'Left' ? 'opacity-80' : ''}`}
                                    >
                                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">{v.name}</td>
                                        <td className="px-4 py-3">{v.companyName || '-'}</td>
                                        <td className="px-4 py-3">{v.phone}</td>
                                        <td className="px-4 py-3">{v.whomToMeet}</td>
                                        <td className="px-4 py-3">{v.purpose}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">{new Date(v.checkInTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-orange-500">{v.checkOutTime ? new Date(v.checkOutTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '-'}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${v.status === 'Inside' ? 'bg-green-100 text-green-700' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400'}`}>
                                                {v.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* New Entry Modal */}
            {isEntryModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white dark:bg-slate-800 z-10">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white ">New Visitor Entry</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 ">Enter visitor details and capture photos.</p>
                            </div>
                            <button onClick={() => setIsEntryModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:text-gray-400 transition-colors bg-gray-50 dark:bg-slate-800 /50 p-2 rounded-full hover:bg-gray-100 dark:bg-slate-700">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-8">
                            <form onSubmit={handleCheckIn} className="space-y-8">

                                {/* Section 1: Visitor Personals */}
                                <div className="space-y-4">
                                    <h4 className="text-sm font-bold text-gray-400 tracking-wider uppercase flex items-center gap-2 mb-4">
                                        <User size={16} /> Visitor Information
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                        <div className="md:col-span-1 lg:col-span-1">
                                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Full Name <span className="text-red-500">*</span></label>
                                            <input required type="text" value={visitorName} onChange={e => setVisitorName(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400" placeholder="e.g. Rahul Kumar" />
                                        </div>
                                        <div className="md:col-span-1 lg:col-span-1">
                                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Phone Number <span className="text-red-500">*</span></label>
                                            <input required type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400" placeholder="e.g. 9876543210" />
                                        </div>
                                        <div className="md:col-span-1 lg:col-span-2">
                                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Company Name (Optional)</label>
                                            <div className="relative">
                                                <Building size={18} className="absolute left-3 top-3 text-gray-400" />
                                                <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400" placeholder="e.g. DHL Logistics" />
                                            </div>
                                        </div>
                                        <div className="md:col-span-3 lg:col-span-4">
                                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Address (Optional)</label>
                                            <div className="relative">
                                                <MapPin size={18} className="absolute left-3 top-3 text-gray-400" />
                                                <textarea value={address} onChange={e => setAddress(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400 resize-none h-20" placeholder="Enter visitor's address..." />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Section 2: Meeting Details */}
                                <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-slate-700 ">
                                    <h4 className="text-sm font-bold text-gray-400 tracking-wider uppercase flex items-center gap-2 mb-4">
                                        <Users size={16} /> Meeting Details
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                        <div className="md:col-span-1 lg:col-span-2">
                                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Whom to Meet <span className="text-red-500">*</span></label>
                                            <input required type="text" value={whomToMeet} onChange={e => setWhomToMeet(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400" placeholder="e.g. HR Manager / Mr. Sharma" />
                                        </div>
                                        <div className="md:col-span-1 lg:col-span-2">
                                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Purpose of Visit <span className="text-red-500">*</span></label>
                                            <input required type="text" value={purpose} onChange={e => setPurpose(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400" placeholder="e.g. Interview, Delivery, Meeting" />
                                        </div>
                                    </div>
                                </div>

                                {/* Section 3: Asset Details */}
                                <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-slate-700 ">
                                    <h4 className="text-sm font-bold text-gray-400 tracking-wider uppercase flex items-center gap-2 mb-4">
                                        <Camera size={16} /> Photos & Vehicle
                                    </h4>
                                    <div className="flex gap-6">
                                        <div className="space-y-3 w-64 max-w-full">
                                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Visitor Photo <span className="text-red-500">*</span></label>
                                            {visitorPhoto ? (
                                                <div className="relative group w-full h-48 bg-gray-100 dark:bg-slate-700 rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700 ">
                                                    <img src={visitorPhoto} alt="Visitor" className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <button type="button" onClick={() => setVisitorPhoto(null)} className="bg-red-500 text-white px-3 py-1.5 rounded-lg text-sm font-bold shadow-lg hover:scale-105 transition-transform flex items-center gap-2">
                                                            <X size={14} /> Remove
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button type="button" onClick={() => setCaptureMode('visitor')} className="w-full h-48 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50 transition-all group">
                                                    <div className="p-3 bg-gray-100 dark:bg-slate-700 rounded-full group-hover:bg-white dark:bg-slate-800 mb-2 transition-colors">
                                                        <Camera size={24} />
                                                    </div>
                                                    <span className="text-sm font-medium">Click to Capture Photo</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="pt-6 border-t border-gray-100 dark:border-slate-700 flex justify-end gap-3 sticky bottom-0 bg-white dark:bg-slate-800 p-4 -mx-6 -mb-6 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] rounded-b-2xl">
                                    <button type="button" onClick={() => setIsEntryModalOpen(false)} className="px-6 py-2.5 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-100 dark:bg-slate-700 rounded-xl transition-colors">
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={entryLoading}
                                        className="px-8 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 hover:shadow-blue-500/30 transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        {entryLoading ? <LoadingSpinner /> : <Save size={18} />} Check-In Visitor
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Webcam Modal (Overlay on top of Entry Modal) */}
            {captureMode && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-2xl w-full max-w-lg border border-gray-800">
                        <div className="relative bg-black h-[400px] flex items-center justify-center overflow-hidden">
                            <Webcam
                                audio={false}
                                ref={webcamRef}
                                screenshotFormat="image/jpeg"
                                videoConstraints={{ facingMode: "user" }}
                                className="absolute inset-0 w-full h-full object-cover"
                            />
                            {/* Camera Frame Overlay */}
                            <div className="absolute inset-0 border-[40px] border-black/50 pointer-events-none"></div>
                            <div className="absolute inset-10 border-2 border-white/30 rounded-lg pointer-events-none"></div>
                            <div className="absolute bottom-4 left-0 right-0 text-center text-white/70 text-sm">Align face/vehicle within frame</div>
                        </div>
                        <div className="p-6 flex justify-between bg-gray-900 border-t border-gray-800">
                            <button onClick={() => setCaptureMode(null)} className="px-6 py-2 text-gray-300 font-bold hover:text-white transition-colors">Cancel</button>
                            <button onClick={capture} className="px-8 py-2 bg-white dark:bg-slate-800 text-black rounded-lg font-bold hover:bg-gray-200 transition-colors flex items-center gap-2">
                                <Camera size={18} /> Capture
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Visitor Details Modal */}
            {selectedVisitor && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Photo Header */}
                        <div className="relative h-64 bg-gray-900 border-b border-gray-100 dark:border-slate-700 ">
                            <img src={selectedVisitor.visitorPhoto || '/placeholder-user.jpg'} alt={selectedVisitor.name} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                            <button onClick={() => setSelectedVisitor(null)} className="absolute top-4 right-4 bg-black/30 hover:bg-black/50 dark:bg-black/70 text-white p-2 rounded-full backdrop-blur-sm transition-all focus:outline-none focus:ring-2 focus:ring-white/50">
                                <X size={20} />
                            </button>
                            <div className="absolute bottom-0 left-0 right-0 p-6 text-white text-left">
                                <h2 className="text-2xl font-bold">{selectedVisitor.name}</h2>
                                {selectedVisitor.companyName && <p className="text-white/80 font-medium flex items-center gap-2"><Building size={14} /> {selectedVisitor.companyName}</p>}
                            </div>
                        </div>

                        {/* Details Body */}
                        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-left">
                            {/* Check-In Status */}
                            <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-800 /50 p-3 rounded-xl border border-gray-100 dark:border-slate-700 ">
                                <div className="text-left">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">Status</p>
                                    <p className={`font-bold ${selectedVisitor.status === 'Inside' ? 'text-green-600' : 'text-gray-600 dark:text-gray-400 '}`}>{selectedVisitor.status}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">Check-In Time</p>
                                    <p className="text-gray-900 dark:text-white font-mono tracking-tight">{new Date(selectedVisitor.checkInTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</p>
                                </div>
                            </div>

                            {/* Info Grid */}
                            <div className="grid grid-cols-2 gap-y-4 text-sm">
                                <div className="text-left">
                                    <p className="text-gray-500 dark:text-gray-400 text-xs uppercase font-bold text-gray-400 mb-0.5">Phone</p>
                                    <p className="font-semibold text-gray-900 dark:text-white ">{selectedVisitor.phone}</p>
                                </div>
                                <div className="text-left">
                                    <p className="text-gray-500 dark:text-gray-400 text-xs uppercase font-bold text-gray-400 mb-0.5">Whom to Meet</p>
                                    <p className="font-semibold text-gray-900 dark:text-white ">{selectedVisitor.whomToMeet}</p>
                                </div>
                                <div className="col-span-2 text-left">
                                    <p className="text-gray-500 dark:text-gray-400 text-xs uppercase font-bold text-gray-400 mb-0.5">Purpose</p>
                                    <p className="font-semibold text-gray-900 dark:text-white ">{selectedVisitor.purpose}</p>
                                </div>
                                <div className="col-span-2 text-left">
                                    <p className="text-gray-500 dark:text-gray-400 text-xs uppercase font-bold text-gray-400 mb-0.5">Address</p>
                                    <p className="font-semibold text-gray-900 dark:text-white ">{selectedVisitor.address || 'N/A'}</p>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 mt-2">
                                <button
                                    onClick={() => downloadIDCard(selectedVisitor)}
                                    className="flex-1 py-3 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold rounded-xl hover:bg-indigo-200 dark:hover:bg-indigo-900/60 transition-all flex items-center justify-center gap-2"
                                >
                                    <FileText size={18} /> Print ID Card
                                </button>
                                {selectedVisitor.status === 'Inside' ? (
                                    <button
                                        onClick={() => {
                                            handleCheckOut(selectedVisitor._id);
                                            setSelectedVisitor(null);
                                        }}
                                        disabled={!!checkoutLoading}
                                        className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-500/30 transition-all flex items-center justify-center gap-2"
                                    >
                                        {checkoutLoading === selectedVisitor._id ? <LoadingSpinner /> : <LogOut size={18} />} Check Out
                                    </button>
                                ) : (
                                    selectedVisitor.checkOutTime && (
                                        <div className="flex-1 text-center py-3 bg-gray-100 dark:bg-slate-700 rounded-xl text-gray-500 dark:text-gray-400 font-medium text-sm border border-gray-200 dark:border-slate-700 flex items-center justify-center">
                                            Checked Out: {new Date(selectedVisitor.checkOutTime).toLocaleString()}
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

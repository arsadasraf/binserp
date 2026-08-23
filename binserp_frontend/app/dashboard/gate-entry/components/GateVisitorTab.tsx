"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import Webcam from 'react-webcam';
import { Eye, Clock, Search, ExternalLink, Calendar, LogIn, LogOut, CheckCircle2, User, Plus, Save, Camera, X, Building, MapPin, Users, History, Activity, FileText, Upload, RotateCcw, Edit2, Trash2 } from 'lucide-react';
import { API_BASE_URL } from '@/src/utils/config';
import { compressImage } from '@/src/utils/imageCompressor';
import ColumnFilter from '../../store/components/tables/ColumnFilter';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import { useHeader } from '@/src/context/HeaderContext';

import { useRouter } from "next/navigation";

export default function GateVisitorTab({ initialViewMode = 'active' }: { initialViewMode?: 'active' | 'history' }) {
    const router = useRouter();
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
    const [viewMode, setViewMode] = useState<'active' | 'history'>(initialViewMode);

    useEffect(() => {
        if (initialViewMode) {
            setViewMode(initialViewMode);
        }
    }, [initialViewMode]);

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

    // Purpose dropdown options
    const PURPOSE_OPTIONS = [
        'Interview',
        'Meeting',
        'Delivery',
        'Vendor Visit',
        'Customer Visit',
        'Maintenance / Service',
        'Audit / Official',
        'Personal',
        'Other'
    ];

    // --- Entry Form State ---
    const [visitorName, setVisitorName] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [whomToMeet, setWhomToMeet] = useState('');
    const [purpose, setPurpose] = useState('');
    const [customPurpose, setCustomPurpose] = useState('');
    const [address, setAddress] = useState('');
    const [phone, setPhone] = useState('');
    const [vehicleNumber, setVehicleNumber] = useState('');
    const [visitorPhoto, setVisitorPhoto] = useState<string | null>(null);
    const [vehiclePhoto, setVehiclePhoto] = useState<string | null>(null);

    // Webcam
    const webcamRef = useRef<Webcam>(null);
    const [captureMode, setCaptureMode] = useState<'visitor' | null>(null);
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

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

    // 5-minute live timer state
    const [nowTime, setNowTime] = useState(Date.now());

    useEffect(() => {
        const timer = setInterval(() => {
            setNowTime(Date.now());
        }, 5000);
        return () => clearInterval(timer);
    }, []);

    const getRemainingEditSeconds = (dateStr: string) => {
        if (!dateStr) return 0;
        const elapsed = (nowTime - new Date(dateStr).getTime()) / 1000;
        return Math.max(0, Math.floor(300 - elapsed));
    };

    const formatRemainingTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${String(secs).padStart(2, '0')}s`;
    };

    // Edit Visitor State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingVisitorId, setEditingVisitorId] = useState<string | null>(null);
    const [editVisitorName, setEditVisitorName] = useState('');
    const [editCompanyName, setEditCompanyName] = useState('');
    const [editWhomToMeet, setEditWhomToMeet] = useState('');
    const [editPurpose, setEditPurpose] = useState('');
    const [editAddress, setEditAddress] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [editVisitorPhoto, setEditVisitorPhoto] = useState<string | null>(null);
    const [editLoading, setEditLoading] = useState(false);

    const handleOpenEditVisitor = (v: any, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const remaining = getRemainingEditSeconds(v.createdAt || v.checkInTime);
        if (remaining <= 0) {
            alert("Edit window (5 minutes) has expired for this visitor log.");
            return;
        }
        setEditingVisitorId(v._id);
        setEditVisitorName(v.name || '');
        setEditCompanyName(v.companyName || '');
        setEditWhomToMeet(v.whomToMeet || '');
        setEditPurpose(v.purpose || '');
        setEditAddress(v.address || '');
        setEditPhone(v.phone || '');
        setEditVisitorPhoto(v.visitorPhoto || null);
        setIsEditModalOpen(true);
    };

    const handleUpdateVisitorSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingVisitorId) return;

        const validationErrors: string[] = [];
        if (!editVisitorName.trim()) validationErrors.push("• Visitor Name: Please enter visitor name.");
        if (!editPhone.trim()) validationErrors.push("• Phone Number: Please enter phone number.");
        if (!editWhomToMeet.trim()) validationErrors.push("• Whom to Meet: Please specify person to meet.");
        if (!editPurpose) validationErrors.push("• Purpose: Please specify purpose.");

        if (validationErrors.length > 0) {
            alert(`Please resolve the following issues:\n\n${validationErrors.join('\n')}`);
            return;
        }

        try {
            setEditLoading(true);
            const token = localStorage.getItem('token');
            await axios.put(`${API_BASE_URL}/api/visitor/${editingVisitorId}`, {
                name: editVisitorName,
                companyName: editCompanyName,
                phone: editPhone,
                whomToMeet: editWhomToMeet,
                purpose: editPurpose,
                address: editAddress,
                visitorPhoto: editVisitorPhoto
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            alert("Visitor log updated successfully!");
            setIsEditModalOpen(false);
            setEditingVisitorId(null);
            if (selectedVisitor && selectedVisitor._id === editingVisitorId) {
                setSelectedVisitor(null);
            }
            loadVisitors();
        } catch (err: any) {
            console.error("Update failed", err);
            alert(err.response?.data?.message || "Failed to update visitor log.");
        } finally {
            setEditLoading(false);
        }
    };

    const handleDeleteVisitor = async (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (!confirm("Are you sure you want to DELETE this visitor log? This action cannot be undone.")) return;

        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_BASE_URL}/api/visitor/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            alert("Visitor log deleted successfully.");
            if (selectedVisitor && selectedVisitor._id === id) {
                setSelectedVisitor(null);
            }
            loadVisitors();
        } catch (err: any) {
            console.error("Delete failed", err);
            alert(err.response?.data?.message || "Failed to delete visitor log.");
        }
    };

    // Checkout
    const handleCheckOut = async (id: string) => {
        if (!confirm("Confirm Check Out?")) return;
        try {
            setCheckoutLoading(id);
            const token = localStorage.getItem('token');
            await axios.put(`${API_BASE_URL}/api/visitor/${id}/checkout`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            alert("Visitor Checked Out Successfully!");
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

    useEffect(() => {
        if (isEntryModalOpen || isEditModalOpen || captureMode !== null || selectedVisitor !== null) {
            setShowBottomNav(false);
        } else {
            setShowBottomNav(true);
        }
        return () => setShowBottomNav(true);
    }, [isEntryModalOpen, isEditModalOpen, captureMode, selectedVisitor, setShowBottomNav]);

    const [compressingPhoto, setCompressingPhoto] = useState(false);

    // Capture Photo with client-side compression
    const capture = useCallback(async () => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc) {
            try {
                setCompressingPhoto(true);
                const compressed = await compressImage(imageSrc, { maxWidth: 1280, maxHeight: 1280, quality: 0.8 });
                if (captureMode === 'visitor') setVisitorPhoto(compressed);
            } catch (err) {
                console.error("Compression failed, using raw capture:", err);
                if (captureMode === 'visitor') setVisitorPhoto(imageSrc);
            } finally {
                setCompressingPhoto(false);
                setCaptureMode(null); // Close camera modal
            }
        }
    }, [webcamRef, captureMode]);

    // Handle Visitor Photo file upload with compression
    const handleVisitorPhotoFile = async (file: File | undefined) => {
        if (!file) return;
        try {
            setCompressingPhoto(true);
            const compressed = await compressImage(file, { maxWidth: 1280, maxHeight: 1280, quality: 0.8 });
            setVisitorPhoto(compressed);
        } catch (err) {
            console.error("Failed to compress visitor photo:", err);
            alert("Failed to compress or load photo. Please try a valid image file.");
        } finally {
            setCompressingPhoto(false);
        }
    };

    // Submit Entry with clear, field-specific validation messages
    const handleCheckIn = async (e: React.FormEvent) => {
        e.preventDefault();
        const finalPurpose = purpose === 'Other' ? customPurpose.trim() : purpose;
        const validationErrors: string[] = [];

        if (!visitorName.trim()) {
            validationErrors.push("• Visitor Name: Please enter the visitor's full name.");
        }
        if (!phone.trim()) {
            validationErrors.push("• Phone Number: Please enter the visitor's mobile number.");
        } else if (phone.trim().replace(/\D/g, '').length < 10) {
            validationErrors.push("• Phone Number: Please enter a valid 10-digit mobile number.");
        }
        if (!whomToMeet.trim()) {
            validationErrors.push("• Whom to Meet: Please specify the employee, officer, or department to meet.");
        }
        if (!finalPurpose) {
            validationErrors.push("• Purpose: Please select or enter the visit purpose.");
        }
        if (!visitorPhoto) {
            validationErrors.push("• Visitor Photo: Please capture or upload the visitor's photo (mandatory for security badge).");
        }

        if (validationErrors.length > 0) {
            alert(`Please resolve the following issues in the Visitor Entry Form:\n\n${validationErrors.join('\n')}`);
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
                purpose: finalPurpose,
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
            setCustomPurpose('');
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
                            onClick={() => {
                                setViewMode('active');
                                router.push('/dashboard/gate-entry/visitor/active');
                            }}
                            className={`flex-1 md:flex-none md:px-6 py-3 rounded-md text-sm font-semibold flex justify-center items-center gap-2 transition-all ${viewMode === 'active' ? 'bg-white dark:bg-slate-800 shadow text-blue-600' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300'}`}
                        >
                            <Activity size={16} /> Active
                        </button>
                        <button
                            onClick={() => {
                                setViewMode('history');
                                router.push('/dashboard/gate-entry/visitor/history');
                            }}
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
                                    <div className="flex flex-col gap-0.5">
                                        <div className="flex items-center gap-1.5">
                                            <History size={12} /> IN: {new Date(v.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        {v.createdBy && <div className="text-[10px] text-gray-400 ml-4">by {v.createdBy.name}</div>}
                                    </div>
                                    {v.checkOutTime && (
                                        <div className="flex flex-col gap-0.5 items-end text-orange-500">
                                            <div className="flex items-center gap-1.5">
                                                <LogOut size={12} /> OUT: {new Date(v.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                            {v.checkedOutBy && <div className="text-[10px] text-gray-400 mr-1">by {v.checkedOutBy.name}</div>}
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
                                <th className="px-4 py-3 align-top text-right">
                                    <div className="font-bold mb-2">Actions</div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={9} className="text-center py-12"><LoadingSpinner /></td>
                                </tr>
                            ) : filteredVisitors.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="text-center py-12 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-800/50 border-dashed">
                                        {searchTerm ? 'No visitors found matching search.' : (viewMode === 'active' ? 'No active visitors currently inside.' : 'No visitor history for this date.')}
                                    </td>
                                </tr>
                            ) : (
                                filteredVisitors.map((v) => {
                                    const remainingSecs = getRemainingEditSeconds(v.createdAt || v.checkInTime);
                                    const canEdit = remainingSecs > 0;

                                    return (
                                        <tr 
                                            key={v._id} 
                                            onClick={() => setSelectedVisitor(v)}
                                            className={`hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors ${v.status === 'Left' ? 'opacity-80' : ''}`}
                                        >
                                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <span>{v.name}</span>
                                                    {canEdit && (
                                                        <span className="px-1.5 py-0.5 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 rounded text-[9px] font-mono font-bold border border-amber-200 dark:border-amber-800">
                                                            {formatRemainingTime(remainingSecs)}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">{v.companyName || '-'}</td>
                                            <td className="px-4 py-3">{v.phone}</td>
                                            <td className="px-4 py-3">{v.whomToMeet}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold inline-block ${
                                                    v.purpose === 'Interview' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800' :
                                                    v.purpose === 'Meeting' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800' :
                                                    v.purpose === 'Delivery' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800' :
                                                    'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                                }`}>
                                                    {v.purpose}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="font-medium">{new Date(v.checkInTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</div>
                                                {v.createdBy && <div className="text-xs text-gray-500">by {v.createdBy.name}</div>}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-orange-500">
                                                {v.checkOutTime ? (
                                                    <>
                                                        <div className="font-medium">{new Date(v.checkOutTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</div>
                                                        {v.checkedOutBy && <div className="text-xs text-gray-500">by {v.checkedOutBy.name}</div>}
                                                    </>
                                                ) : '-'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${v.status === 'Inside' ? 'bg-green-100 text-green-700' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400'}`}>
                                                    {v.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {canEdit ? (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => handleOpenEditVisitor(v, e)}
                                                                title={`Edit Log (${formatRemainingTime(remainingSecs)} left)`}
                                                                className="p-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 rounded-lg transition-colors border border-blue-200 dark:border-blue-800"
                                                            >
                                                                <Edit2 size={14} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => handleDeleteVisitor(v._id, e)}
                                                                title={`Delete Log (${formatRemainingTime(remainingSecs)} left)`}
                                                                className="p-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/50 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 rounded-lg transition-colors border border-red-200 dark:border-red-800"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedVisitor(v)}
                                                            className="px-2 py-1 text-xs text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 font-medium"
                                                        >
                                                            View
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
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
                                        <div className="md:col-span-1 lg:col-span-2 space-y-2">
                                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Purpose of Visit <span className="text-red-500">*</span></label>
                                            <select
                                                required
                                                value={purpose}
                                                onChange={e => setPurpose(e.target.value)}
                                                className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 font-medium"
                                            >
                                                <option value="">Select Purpose...</option>
                                                {PURPOSE_OPTIONS.map(opt => (
                                                    <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                            {purpose === 'Other' && (
                                                <input
                                                    required
                                                    type="text"
                                                    value={customPurpose}
                                                    onChange={e => setCustomPurpose(e.target.value)}
                                                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400 text-sm mt-1"
                                                    placeholder="Specify visitor's purpose..."
                                                />
                                            )}
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
                                                <div className="flex gap-4 w-full">
                                                    <button type="button" disabled={compressingPhoto} onClick={() => setCaptureMode('visitor')} className="flex-1 h-48 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50 transition-all group disabled:opacity-50">
                                                        <div className="p-3 bg-gray-100 dark:bg-slate-700 rounded-full group-hover:bg-white dark:bg-slate-800 mb-2 transition-colors">
                                                            <Camera size={24} />
                                                        </div>
                                                        <span className="text-sm font-medium text-center">Capture Photo<br/><span className="text-xs opacity-70">(Camera)</span></span>
                                                    </button>
                                                    <label className="flex-1 h-48 cursor-pointer border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:border-green-500 hover:text-green-500 hover:bg-green-50 transition-all group">
                                                        <div className="p-3 bg-gray-100 dark:bg-slate-700 rounded-full group-hover:bg-white dark:bg-slate-800 mb-2 transition-colors">
                                                            <Upload size={24} />
                                                        </div>
                                                        <span className="text-sm font-medium text-center">{compressingPhoto ? 'Compressing...' : 'Upload Photo'}<br/><span className="text-xs opacity-70">(Gallery)</span></span>
                                                        <input type="file" accept="image/*" disabled={compressingPhoto} className="hidden" onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            handleVisitorPhotoFile(file);
                                                            e.target.value = '';
                                                        }} />
                                                    </label>
                                                </div>
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
                    <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-2xl w-full max-w-lg border border-gray-800 flex flex-col">
                        
                        {/* Modal Header with Switch Button */}
                        <div className="p-4 bg-gray-900 border-b border-gray-800 flex justify-between items-center">
                            <div className="flex items-center gap-2 text-white font-bold text-sm">
                                <Camera size={18} className="text-blue-400" />
                                <span>Capture Visitor Photo</span>
                            </div>

                            {/* Camera Toggle Button (Front / Back) */}
                            <button
                                type="button"
                                onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')}
                                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-blue-400 hover:text-blue-300 rounded-xl text-xs font-bold border border-gray-700 flex items-center gap-1.5 transition-colors active:scale-95"
                                title="Switch between Front and Back camera"
                            >
                                <RotateCcw size={14} />
                                <span>{facingMode === 'user' ? 'Front (Selfie)' : 'Back (Rear)'}</span>
                            </button>
                        </div>

                        {/* Camera Stream Viewport */}
                        <div className="relative bg-black h-[400px] flex items-center justify-center overflow-hidden">
                            <Webcam
                                key={facingMode}
                                audio={false}
                                ref={webcamRef}
                                screenshotFormat="image/jpeg"
                                videoConstraints={{ facingMode: { ideal: facingMode } }}
                                onUserMediaError={(err) => alert("Could not access camera. Please check permissions.")}
                                className="absolute inset-0 w-full h-full object-cover"
                            />
                            {/* Camera Frame Overlay */}
                            <div className="absolute inset-0 border-[40px] border-black/50 pointer-events-none"></div>
                            <div className="absolute inset-10 border-2 border-white/30 rounded-lg pointer-events-none"></div>
                            
                            {/* Floating Camera Flip Icon */}
                            <div className="absolute top-4 right-4 z-10">
                                <button
                                    type="button"
                                    onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')}
                                    className="p-2.5 bg-black/60 hover:bg-black/80 text-white rounded-full backdrop-blur-md border border-white/30 shadow-lg active:scale-90 transition-transform flex items-center gap-1.5 text-xs font-bold"
                                    title="Flip Camera"
                                >
                                    <RotateCcw size={16} />
                                </button>
                            </div>

                            <div className="absolute bottom-4 left-0 right-0 text-center text-white/80 text-xs font-medium bg-black/50 py-1.5 backdrop-blur-xs">
                                Camera: <strong className="text-white">{facingMode === 'user' ? 'Front / Selfie' : 'Back / Rear'}</strong> • Align within frame
                            </div>
                        </div>

                        {/* Modal Footer Controls */}
                        <div className="p-4 sm:p-6 flex justify-between items-center bg-gray-900 border-t border-gray-800 gap-3">
                            <button 
                                type="button" 
                                onClick={() => setCaptureMode(null)} 
                                className="px-6 py-2.5 text-gray-300 font-bold hover:text-white transition-colors text-sm"
                            >
                                Cancel
                            </button>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')}
                                    className="sm:hidden p-2.5 bg-gray-800 hover:bg-gray-700 text-blue-400 rounded-xl border border-gray-700"
                                    title="Flip Camera"
                                >
                                    <RotateCcw size={18} />
                                </button>
                                <button 
                                    type="button" 
                                    onClick={capture} 
                                    className="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-blue-500/30 flex items-center gap-2 text-sm"
                                >
                                    <Camera size={18} /> Capture Photo
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Visitor Details Modal */}
            {selectedVisitor && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md md:max-w-4xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">
                        {/* Photo Header */}
                        <div className="relative h-64 md:h-auto md:w-1/2 bg-gray-900 border-b md:border-b-0 md:border-r border-gray-100 dark:border-slate-700 ">
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
                        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-left md:w-1/2">
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
                            <div className="space-y-3 mt-2">
                                <div className="flex gap-3">
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

                                {/* 5-Minute Edit / Delete Grace Controls */}
                                {getRemainingEditSeconds(selectedVisitor.createdAt || selectedVisitor.checkInTime) > 0 && (
                                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                            <Clock size={16} className="text-amber-600 dark:text-amber-400" />
                                            <div className="text-xs">
                                                <span className="font-bold text-amber-800 dark:text-amber-200">5-Min Grace Window: </span>
                                                <span className="font-mono font-bold text-amber-700 dark:text-amber-300">{formatRemainingTime(getRemainingEditSeconds(selectedVisitor.createdAt || selectedVisitor.checkInTime))} remaining</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const visitorToEdit = selectedVisitor;
                                                    setSelectedVisitor(null);
                                                    handleOpenEditVisitor(visitorToEdit);
                                                }}
                                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-sm transition-all"
                                            >
                                                <Edit2 size={13} /> Edit
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteVisitor(selectedVisitor._id)}
                                                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-sm transition-all"
                                            >
                                                <Trash2 size={13} /> Delete
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Visitor Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white dark:bg-slate-800 z-10">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Edit2 size={20} className="text-blue-600" /> Edit Visitor Log
                                </h3>
                                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                                    Within 5-minute correction window
                                </p>
                            </div>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:text-gray-300 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6">
                            <form onSubmit={handleUpdateVisitorSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1.5">
                                        Visitor Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={editVisitorName}
                                        onChange={e => setEditVisitorName(e.target.value)}
                                        required
                                        className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                        placeholder="Full Name"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1.5">
                                            Phone Number <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="tel"
                                            value={editPhone}
                                            onChange={e => setEditPhone(e.target.value)}
                                            required
                                            className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                            placeholder="Mobile Number"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1.5">
                                            Company / Organization
                                        </label>
                                        <input
                                            type="text"
                                            value={editCompanyName}
                                            onChange={e => setEditCompanyName(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                            placeholder="Company Name"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1.5">
                                            Whom to Meet <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={editWhomToMeet}
                                            onChange={e => setEditWhomToMeet(e.target.value)}
                                            required
                                            className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                            placeholder="Staff/Officer Name"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1.5">
                                            Purpose <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={editPurpose}
                                            onChange={e => setEditPurpose(e.target.value)}
                                            required
                                            className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                        >
                                            <option value="">Select Purpose</option>
                                            {PURPOSE_OPTIONS.map((opt) => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1.5">
                                        Address / Location
                                    </label>
                                    <input
                                        type="text"
                                        value={editAddress}
                                        onChange={e => setEditAddress(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                        placeholder="Visitor Address"
                                    />
                                </div>

                                <div className="pt-4 border-t border-gray-100 dark:border-slate-700 flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsEditModalOpen(false)}
                                        className="px-6 py-2.5 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={editLoading}
                                        className="px-8 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition-all flex items-center gap-2 disabled:opacity-70"
                                    >
                                        {editLoading ? <LoadingSpinner /> : <Save size={18} />} Update Visitor
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

"use client";

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { LogOut, Truck, User, Search, Car, Calendar, History, Activity, Save, Building, X, MapPin } from 'lucide-react';
import Webcam from 'react-webcam';
import { API_BASE_URL } from '@/src/utils/config';
import LoadingSpinner from '@/src/components/LoadingSpinner';

export default function GateVehicleTab() {
    const [visitors, setVisitors] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // View Mode: 'active' | 'history'
    const [viewMode, setViewMode] = useState<'active' | 'history'>('active');
    const [directionTab, setDirectionTab] = useState<'Inward' | 'Outward'>('Inward');
    
    const [historyFilterType, setHistoryFilterType] = useState<'daywise' | 'monthwise'>('daywise');
    const [historyDate, setHistoryDate] = useState(new Date().toISOString().split('T')[0]); // YYYY-MM-DD
    const [historyMonth, setHistoryMonth] = useState(() => {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
    });

    // Selected Vehicle for Details Modal
    const [selectedVehicle, setSelectedVehicle] = useState<any>(null);

    // Modal State
    const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
    const [entryLoading, setEntryLoading] = useState(false);

    // --- Entry Form State ---
    const [direction, setDirection] = useState<'Inward' | 'Outward'>('Inward');
    const [driverName, setDriverName] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [goodsType, setGoodsType] = useState('');
    const [address, setAddress] = useState('');
    const [phone, setPhone] = useState('');
    const [vehicleNumber, setVehicleNumber] = useState('');
    const [remarks, setRemarks] = useState(''); // Mapping to 'purpose'
    const [documentPhotos, setDocumentPhotos] = useState<string[]>([]);
    const [vehiclePhotos, setVehiclePhotos] = useState<string[]>([]);

    // Webcam
    const webcamRef = React.useRef<any>(null); // Type 'any' used to bypass strict ref typing issues with react-webcam
    const [captureMode, setCaptureMode] = useState<'document' | 'vehicle' | null>(null);

    // Capture Photo
    const capture = useCallback(() => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc) {
            if (captureMode === 'document') setDocumentPhotos(prev => [...prev, imageSrc]);
            if (captureMode === 'vehicle') setVehiclePhotos(prev => [...prev, imageSrc]);
            setCaptureMode(null);
        }
    }, [webcamRef, captureMode]);

    // Submit Entry
    const handleCheckIn = async (e: React.FormEvent) => {
        e.preventDefault();
        const missingFields = [];
        if (!vehicleNumber) missingFields.push("Vehicle Number");
        if (!driverName) missingFields.push("Driver Name");
        if (!phone) missingFields.push("Phone Number");
        if (!companyName) missingFields.push("Company Name");
        if (!goodsType) missingFields.push("Goods Type");
        if (vehiclePhotos.length === 0) missingFields.push("Vehicle Photo");

        if (missingFields.length > 0) {
            alert(`Please fill the following required fields:\n- ${missingFields.join('\n- ')}`);
            return;
        }

        try {
            setEntryLoading(true);
            const token = localStorage.getItem('token');
            await axios.post(`${API_BASE_URL}/api/vehicle`, {
                driverName,
                phone,
                companyName,
                goodsType,
                address,
                vehicleNumber,
                direction,
                purpose: remarks || 'Logistics', // Default purpose if empty
                documentPhotos, 
                vehiclePhotos
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            alert("Vehicle Checked In Successfully!");
            // Reset form
            setDirection('Inward');
            setDriverName('');
            setCompanyName('');
            setPhone('');
            setGoodsType('');
            setAddress('');
            setVehicleNumber('');
            setRemarks('');
            setDocumentPhotos([]);
            setVehiclePhotos([]);
            setIsEntryModalOpen(false);

            // Refresh list
            loadVehicles();
        } catch (error) {
            console.error("Check-in failed", error);
            alert("Failed to check in vehicle.");
        } finally {
            setEntryLoading(false);
        }
    };

    // Load Vehicles (Visitors with vehicles)
    const loadVehicles = useCallback(async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            let url = `${API_BASE_URL}/api/vehicle/active`;
            let params = {};

            if (viewMode === 'history') {
                url = `${API_BASE_URL}/api/vehicle`; // Get all (filtered)
                
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

            // Use vehicles array directly from response
            setVisitors(res.data.vehicles || []);
        } catch (error) {
            console.error("Load vehicles failed", error);
        } finally {
            setLoading(false);
        }
    }, [viewMode, historyDate, historyFilterType, historyMonth]);

    useEffect(() => {
        loadVehicles();
    }, [loadVehicles]);

    const handleCheckOut = async (id: string) => {
        if (!confirm("Confirm Check Out?")) return;
        try {
            setCheckoutLoading(id);
            const token = localStorage.getItem('token');
            await axios.put(`${API_BASE_URL}/api/vehicle/${id}/checkout`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // If in active view, remove from list. If history, reload to update status.
            if (viewMode === 'active') {
                setVisitors(prev => prev.filter(v => v._id !== id));
            } else {
                loadVehicles();
            }
        } catch (error) {
            console.error("Checkout failed", error);
            alert("Failed to check out.");
        } finally {
            setCheckoutLoading(null);
        }
    };

    const filteredVehicles = visitors.filter(v =>
        (v.direction === directionTab || (!v.direction && directionTab === 'Inward')) && 
        (v.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // Carousel state for selected vehicle
    const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
    const allPhotos = selectedVehicle ? [...(selectedVehicle.vehiclePhotos || []), ...(selectedVehicle.documentPhotos || [])] : [];

    const nextPhoto = () => {
        setCurrentPhotoIndex((prev) => (prev + 1) % allPhotos.length);
    };

    const prevPhoto = () => {
        setCurrentPhotoIndex((prev) => (prev - 1 + allPhotos.length) % allPhotos.length);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 gap-4">

                {/* Left: Title & Toggles */}
                <div className="flex items-center gap-4">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">Vehicle Log</h2>
                    <div className="flex bg-gray-100 dark:bg-slate-700 p-1 rounded-lg">
                        <button
                            onClick={() => setViewMode('active')}
                            className={`px-3 py-1.5 rounded-md text-sm font-semibold flex items-center gap-2 transition-all ${viewMode === 'active' ? 'bg-white dark:bg-slate-800 shadow text-blue-600' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300'}`}
                        >
                            <Activity size={16} /> Active
                        </button>
                        <button
                            onClick={() => setViewMode('history')}
                            className={`px-3 py-1.5 rounded-md text-sm font-semibold flex items-center gap-2 transition-all ${viewMode === 'history' ? 'bg-white dark:bg-slate-800 shadow text-blue-600' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300'}`}
                        >
                            <History size={16} /> History
                        </button>
                    </div>

                    <div className="flex bg-gray-100 dark:bg-slate-700 p-1 rounded-lg ml-4">
                        <button
                            onClick={() => setDirectionTab('Inward')}
                            className={`px-3 py-1.5 rounded-md text-sm font-semibold flex items-center gap-2 transition-all ${directionTab === 'Inward' ? 'bg-white dark:bg-slate-800 shadow text-indigo-600' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300'}`}
                        >
                             Inward
                        </button>
                        <button
                            onClick={() => setDirectionTab('Outward')}
                            className={`px-3 py-1.5 rounded-md text-sm font-semibold flex items-center gap-2 transition-all ${directionTab === 'Outward' ? 'bg-white dark:bg-slate-800 shadow text-indigo-600' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300'}`}
                        >
                             Outward
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

                    {/* <div className="relative flex-1 md:flex-none">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search vehicle..."
                            className="pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none w-full md:w-64"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div> */}

                    {/* New Entry Button */}
                    <button
                        onClick={() => setIsEntryModalOpen(true)}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors whitespace-nowrap shadow-sm hover:shadow-md"
                    >
                        <Truck size={18} /> New Vehicle
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in">
                {loading ? <div className="col-span-4 text-center py-12"><LoadingSpinner /></div> : filteredVehicles.length === 0 ? (
                    <div className="col-span-4 text-center py-12 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-800 /50 rounded-xl border border-dashed">
                        {searchTerm ? 'No vehicles found matching search.' : (viewMode === 'active' ? 'No active vehicles found inside.' : 'No vehicle history for this date.')}
                    </div>
                ) : (
                    filteredVehicles.map((v) => (
                        <div
                            key={v._id}
                            onClick={() => { setSelectedVehicle(v); setCurrentPhotoIndex(0); }}
                            className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border p-4 cursor-pointer hover:shadow-md transition-all group ${v.status === 'Left' ? 'border-gray-100 dark:border-slate-700 opacity-80' : 'border-blue-100 ring-1 ring-blue-50'}`}
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 className="font-bold text-lg text-gray-900 dark:text-white font-mono tracking-tight line-clamp-1">{v.vehicleNumber}</h3>
                                    {v.companyName && (
                                        <div className="text-xs font-semibold text-blue-600 mt-0.5 flex items-center gap-1">
                                            <Building size={10} /> {v.companyName}
                                        </div>
                                    )}
                                </div>
                                <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${v.status === 'Inside' ? 'bg-green-100 text-green-700' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 '}`}>
                                    {v.status}
                                </div>
                            </div>

                            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400 ">
                                <div className="flex items-center gap-2 text-xs"><User size={12} className="text-gray-400" /> Driver: <span className="font-medium text-gray-900 dark:text-white ">{v.name}</span></div>
                                <div className="flex items-center gap-2 text-xs"><Activity size={12} className="text-gray-400" /> Type: <span className="font-medium text-gray-900 dark:text-white ">{v.goodsType || 'Logistics'}</span></div>
                                <div className="flex items-center gap-2 text-xs text-gray-400 mt-2 pt-2 border-t border-gray-50">
                                    <History size={12} /> IN: {new Date(v.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* New Vehicle Entry Modal */}
            {isEntryModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white dark:bg-slate-800 z-10">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white ">New Vehicle Entry</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 ">Enter logistics and driver details.</p>
                            </div>
                            <button onClick={() => setIsEntryModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:text-gray-400 transition-colors bg-gray-50 dark:bg-slate-800 /50 p-2 rounded-full hover:bg-gray-100 dark:bg-slate-700">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-8">
                            <form onSubmit={handleCheckIn} className="space-y-8">

                                <div className="space-y-4">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="text-sm font-bold text-gray-400 tracking-wider uppercase flex items-center gap-2">
                                            Logistics Information
                                        </h4>
                                        <div className="flex bg-gray-100 dark:bg-slate-700 p-1 rounded-lg">
                                            <button type="button" onClick={() => setDirection('Inward')} className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${direction === 'Inward' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>Inward</button>
                                            <button type="button" onClick={() => setDirection('Outward')} className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${direction === 'Outward' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>Outward</button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Company Name <span className="text-red-500">*</span></label>
                                            <div className="relative">
                                                <input required type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} className="w-full pl-4 pr-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400" placeholder="e.g. DHL Logistics / Vendor Name" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Vehicle Number <span className="text-red-500">*</span></label>
                                            <div className="relative">
                                                <Truck size={18} className="absolute left-3 top-3 text-gray-400" />
                                                <input required type="text" value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400 uppercase" placeholder="KA-01-AB-1234" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Goods Type <span className="text-red-500">*</span></label>
                                            <input required type="text" value={goodsType} onChange={e => setGoodsType(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400" placeholder="e.g. Raw Material, FG, Machinery" />
                                        </div>
                                    </div>
                                </div>

                                {/* Section 2: Driver Details */}
                                <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-slate-700 ">
                                    <h4 className="text-sm font-bold text-gray-400 tracking-wider uppercase flex items-center gap-2 mb-4">
                                        Driver Details
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Driver Name <span className="text-red-500">*</span></label>
                                            <input required type="text" value={driverName} onChange={e => setDriverName(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400" placeholder="e.g. Driver Name" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Phone Number <span className="text-red-500">*</span></label>
                                            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400" placeholder="e.g. 9876543210" />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Address</label>
                                            <input type="text" value={address} onChange={e => setAddress(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400" placeholder="Enter driver's address..." />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Remarks / Purpose</label>
                                            <input type="text" value={remarks} onChange={e => setRemarks(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400" placeholder="e.g. Delivery for Block A" />
                                        </div>
                                    </div>
                                </div>

                                {/* Section 3: Photos */}
                                <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-slate-700 ">
                                    <h4 className="text-sm font-bold text-gray-400 tracking-wider uppercase flex items-center gap-2 mb-4">
                                        Photos
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                                        <div className="space-y-3">
                                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Vehicle Info <span className="text-red-500">*</span></label>
                                            <div className="flex flex-wrap gap-2">
                                                {vehiclePhotos.map((photo, index) => (
                                                    <div key={index} className="relative group w-24 h-24 bg-gray-100 dark:bg-slate-700 rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700 shrink-0">
                                                        <img src={photo} alt={`Vehicle ${index + 1}`} className="w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                            <button type="button" onClick={() => setVehiclePhotos(prev => prev.filter((_, i) => i !== index))} className="bg-red-500 text-white p-1.5 rounded-lg text-xs font-bold shadow-lg hover:scale-105 transition-transform flex items-center justify-center">
                                                                <X size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                                <button type="button" onClick={() => setCaptureMode('vehicle')} className="w-24 h-24 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50 transition-all group shrink-0">
                                                    <Truck size={20} className="mb-1" />
                                                    <span className="text-[10px] font-medium text-center leading-tight">Add<br/>Photo</span>
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Document / ID Proof</label>
                                            <div className="flex flex-wrap gap-2">
                                                {documentPhotos.map((photo, index) => (
                                                    <div key={index} className="relative group w-24 h-24 bg-gray-100 dark:bg-slate-700 rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700 shrink-0">
                                                        <img src={photo} alt={`Document ${index + 1}`} className="w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                            <button type="button" onClick={() => setDocumentPhotos(prev => prev.filter((_, i) => i !== index))} className="bg-red-500 text-white p-1.5 rounded-lg text-xs font-bold shadow-lg hover:scale-105 transition-transform flex items-center justify-center">
                                                                <X size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                                <button type="button" onClick={() => setCaptureMode('document')} className="w-24 h-24 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50 transition-all group shrink-0">
                                                    <User size={20} className="mb-1" />
                                                    <span className="text-[10px] font-medium text-center leading-tight">Add<br/>Photo</span>
                                                </button>
                                            </div>
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
                                        {entryLoading ? <LoadingSpinner /> : <Truck size={18} />} Check-In Vehicle
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
                                Capture
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Vehicle Details Modal */}
            {selectedVehicle && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Photo Slider Header */}
                        <div className="relative h-64 bg-gray-900 border-b border-gray-100 dark:border-slate-700 flex items-center justify-center group overflow-hidden">
                            {allPhotos.length > 0 ? (
                                <>
                                    <img src={allPhotos[currentPhotoIndex]} alt="Vehicle Preview" className="w-full h-full object-cover transition-opacity duration-300" />
                                    
                                    {allPhotos.length > 1 && (
                                        <>
                                            <button onClick={prevPhoto} className="absolute left-4 bg-black/50 hover:bg-black/80 text-white p-2 rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all z-10">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                            </button>
                                            <button onClick={nextPhoto} className="absolute right-4 bg-black/50 hover:bg-black/80 text-white p-2 rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all z-10">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                            </button>
                                            
                                            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-1.5 z-10">
                                                {allPhotos.map((_, idx) => (
                                                    <div key={idx} className={`w-2 h-2 rounded-full ${idx === currentPhotoIndex ? 'bg-white' : 'bg-white/40'}`}></div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </>
                            ) : (
                                <img src="/placeholder-vehicle.jpg" alt="Placeholder" className="w-full h-full object-cover" />
                            )}
                            
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none"></div>
                            <button onClick={() => setSelectedVehicle(null)} className="absolute top-4 right-4 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full backdrop-blur-sm transition-all focus:outline-none z-20">
                                <X size={20} />
                            </button>

                            <div className="absolute bottom-0 left-0 right-0 p-6 text-white text-left z-20 pointer-events-none">
                                <h2 className="text-2xl font-bold font-mono uppercase tracking-tight">{selectedVehicle.vehicleNumber}</h2>
                                {selectedVehicle.companyName && <p className="text-white/80 font-medium flex items-center gap-2"><Building size={14} /> {selectedVehicle.companyName}</p>}
                                <p className="text-indigo-300 font-bold text-xs uppercase tracking-wider mt-1">{selectedVehicle.direction || 'Inward'} Vehicle</p>
                            </div>
                        </div>

                        {/* Details Body */}
                        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-left">
                            {/* Check-In Status */}
                            <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-800 /50 p-3 rounded-xl border border-gray-100 dark:border-slate-700 ">
                                <div className="text-left">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">Status</p>
                                    <p className={`font-bold ${selectedVehicle.status === 'Inside' ? 'text-green-600' : 'text-gray-600 dark:text-gray-400 '}`}>{selectedVehicle.status}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">Check-In Time</p>
                                    <p className="text-gray-900 dark:text-white font-mono tracking-tight">{new Date(selectedVehicle.checkInTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</p>
                                </div>
                            </div>

                            {/* Info Grid */}
                            <div className="grid grid-cols-2 gap-y-4 text-sm">
                                <div className="text-left">
                                    <p className="text-gray-500 dark:text-gray-400 text-xs uppercase font-bold text-gray-400 mb-0.5">Driver Name</p>
                                    <p className="font-semibold text-gray-900 dark:text-white ">{selectedVehicle.name}</p>
                                </div>
                                <div className="text-left">
                                    <p className="text-gray-500 dark:text-gray-400 text-xs uppercase font-bold text-gray-400 mb-0.5">Phone</p>
                                    <p className="font-semibold text-gray-900 dark:text-white ">{selectedVehicle.phone}</p>
                                </div>
                                <div className="col-span-2 text-left">
                                    <p className="text-gray-500 dark:text-gray-400 text-xs uppercase font-bold text-gray-400 mb-0.5">Goods Type</p>
                                    <p className="font-semibold text-gray-900 dark:text-white ">{selectedVehicle.goodsType || 'N/A'}</p>
                                </div>
                                <div className="col-span-2 text-left">
                                    <p className="text-gray-500 dark:text-gray-400 text-xs uppercase font-bold text-gray-400 mb-0.5">Remarks / Purpose</p>
                                    <p className="font-semibold text-gray-900 dark:text-white ">{selectedVehicle.purpose}</p>
                                </div>
                                <div className="col-span-2 text-left">
                                    <p className="text-gray-500 dark:text-gray-400 text-xs uppercase font-bold text-gray-400 mb-0.5">Address</p>
                                    <p className="font-semibold text-gray-900 dark:text-white ">{selectedVehicle.address || 'N/A'}</p>
                                </div>
                            </div>

                            {/* Removed static Additional Photos Gallery in favor of the new Photo Carousel Slider */}

                            {/* Actions */}
                            {selectedVehicle.status === 'Inside' ? (
                                <button
                                    onClick={() => {
                                        handleCheckOut(selectedVehicle._id);
                                        setSelectedVehicle(null);
                                    }}
                                    disabled={!!checkoutLoading}
                                    className="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-500/30 transition-all flex items-center justify-center gap-2"
                                >
                                    {checkoutLoading === selectedVehicle._id ? <LoadingSpinner /> : <LogOut size={20} />} Check Out Vehicle
                                </button>
                            ) : (
                                selectedVehicle.checkOutTime && (
                                    <div className="text-center py-2 bg-gray-100 dark:bg-slate-700 rounded-lg text-gray-500 dark:text-gray-400 font-medium text-sm border border-gray-200 dark:border-slate-700 ">
                                        Checked Out: {new Date(selectedVehicle.checkOutTime).toLocaleString()}
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div >
    );
}
